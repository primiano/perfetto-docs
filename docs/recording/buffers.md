# Buffers and dataflow

This page describes the overall dataflow of trace data in Perfetto highlighting
... TODO the buffers involved and giving advice on how to size them.

Perfetto tracing is an asynchronous multiple-writer single-reader pipeline. In
many senses, its architecture is very similar to modern GPU's command buffers.

In a nutshell, the design principles of the tracing dataflow are:

* The tracing fastpath is based on direct writes into a shared memory buffer.
* Highly optimized for low-overhead writing. NOT optimized for low-latency
  reading.
* Trace data is eventually committed in the central trace buffer by the end
  of the trace.
* An IPC channel allows synchronization and fencing of data writes if
  needed.

In the general case there are two types buffers involved in a perfetto trace
(three when pulling data from the Linux kernel's ftrace infrastructure):

![Buffers](/docs/images/buffers.png)

#### Tracing service's central buffers

These buffers (yellow, in the picture above) are defined by the user in the
`buffers` section of the [trace config](config.md). In the most simple cases,
one tracing session = one buffer, regardless of the number of data sources and
producers.

This is the place where the tracing data is ultimately kept, while in memory,
whether it comes from the kernel ftrace infrastructure, from some other data
source in `traced_probes` or from another userspace process using the
[Perfetto Client Library](/docs/TODO.md).
At the end of the trace (or during, if in [streaming mode]) these buffers will
be written into the output trace file.

These buffers will potentially contain a mixture of trace packets coming from
different data sources and even different producer processes. What-goes-where
is defined in the [buffers mapping section](#dynamic-buffer-mapping) of the
trace config. Because of this, the tracing buffers are not shared across
processes, to avoid cross-talking and information leaking across producer
processes that can't trust each other.

#### Shared memory buffers

Each producer process has one (and only one) memory buffer shared 1:1 with the
tracing service, regardless of the number of data sources it hosts (blue, in the
picture above). This buffer is a temporary staging buffer and has two purposes:

1. Allowing direct serialization of the data in a buffer that the tracing
   service can read (i.e. zero-copy on the write path)

2. Decupling writes from reads of the tracing service.

The tracing service has the job of moving trace packets from the shared memory
buffer (blue) into the final memory buffer (yellow) as fast as it can.

The shared memory buffer hides the scheduling and response latencies of the
tracing service, allowing the producer to keep writing without losing data when
the tracing service is temporarily blocked.

#### Ftrace buffer

When the `linux.ftrace` data source is enabled, the kernel will have its own
per-CPU buffers. The `traced_probes` process will periodically read those
buffers, convert the data into binary protos and follow the same dataflow of
userspace tracing. These buffers need to be just large enough to hold data
between two frace read cycles (`TraceConfig.FtraceConfig.drain_period_ms`).

## Life of a trace packet

Here is a step-by-step example to fully understand the dataflow of trace packets
across buffers. Let's assume a producer process with two data sources writing
packets at a different rate, both targeting the same central buffer.

1. When each data source starts writing, it will grab a free page of the shared
   memory buffer and directly serialize proto-encoded tracing data onto it.

2. When the shared memory buffer page is filled, the producer will send an async
   IPC to the service, asking it to copy the shared memory page just written,
   and grab the next free page in the shared memory buffer.

3. When the service receives the IPC it will copy the shared memory page into
   the central buffer and mark the shared memory buffer page as free. Another
   data source within that producer will be able to reuse that page.

4. When the tracing session ends, the service will send a `Flush` request to all
   the data sources. This will cause all outstanding shared memory pages to be
   committed, even if not completely full, and copied into the service's central
   buffer.

![Dataflow animation](/docs/images/dataflow.svg)

## Buffer sizing

#### Central buffer sizing

The math for sizing the central buffer is quite straightforward: in the default
case tracing without `write_into_file` (i.e. when the trace file is written at
the end of the trace), the buffer will hold as much data as it has been
written by the various data sources.

The total length of the trace will be `(buffer size) / (aggregated write rate)`.
If all producers write at a combined rate of 2 MB/s, a 16 MB buffer will hold
~ 8 seconds of tracing data.

The write rate is highly dependent on the data sources configured and by the
activity of the system. 1-2 MB/s are typical figures on Android traces with
scheduler tracing, but can go up easily by 1+ orders of magnitude if chattier
data sources are enabled (e.g., syscall of pagefault tracing).

When using [streaming mode] the buffer needs to be able to hold enough data
between two `file_write_period_ms` periods (default: 5s).
For instance, if `file_write_period_ms = 5000` and the write data rate is 2 MB/s
the central buffer needs to be at least 5 * 2 = 10 MB to avoid data losses.

#### Shared memory buffer sizing

The sizing of the shared memory buffer depends on:

* The scheduling charateristics of the underlying system, i.e. for how long the
 tracing service can be blocked on the scheduler queues. This is a function of
 the kernel configuration and nice-ness level of the `traced` process.
* The max write rate of all data sources within a producer process.

Suppose that a producer produce at a max rate of 8 MB/s. If `traced` gets
blocked for 10 ms, the shared memory buffer need to be at least 8 * 0.01 = 80 KB
to avoid losses.

Empirical measuements suggest that on most Android systems a shared memory
buffer size of 128-512 KB is good enough.

The default shared memory buffer size is 256 KB. When using the Perfetto Client
Library, this value can be tweaked setting `TracingInitArgs.shmem_size_hint_kb`.

WARNING: if a data source writes very large trace packets in a single batch,
either the shared memory buffer needs to be big enough to handle that or
`BufferExhaustedPolicy.kStall` must be employed.

For instance, consider a data source that emits a 2MB screenshot every 10s.
Its code, over simplifying, would look like:
```c++
for (;;) {
  ScreenshotDataSource::Trace([](ScreenshotDataSource::TraceContext ctx) {
    auto packet = ctx.NewTracePacket();
    packet.set_bitmap(Grab2MBScreenshot());
  });
  std::this_thread::sleep_for(std::chrono::seconds(10));
}
```

Its average write rate is 2MB / 10 = 200 KB/s. However, the data source will
make bursts of 2MB back-to-back without ever yielding, limited only by the
tracing serialization overhead. In practice it will write that 2MB buffer at
O(GB/s). If the shared memory buffer is < 2 MB, the tracing service will be
unlkely to catch up at that rate and data losses will be experienced.

In a case like this thes options are:

* Increase the size of the shared memory buffer in the producer that hosts the
  data source.
* Split the write into chunks spaced by some delay.
* Adopt the `BufferExhaustedPolicy::kStall` when defining the data source:
  ```c++
class ScreenshotDataSource : public perfetto::DataSource<ScreenshotDataSource> {
 public:
  constexpr static BufferExhaustedPolicy kBufferExhaustedPolicy =
      BufferExhaustedPolicy::kStall;
 ...
};
```


## Debugging data losses

#### Ftrace kernel buffer losses

When using the Linux kernel ftrace data source, losses can occur in the
kernel -> userspace path if the `traced_probes` process gets blocked for too
long.

At the trace proto level, losses in this path are recorded:
* In the [`FtraceCpuStats`][FtraceCpuStats] messages, emitted both at the
  beginning and end of the trace. If the `overrun` field is non-zero, data has
  been lost.
* In the [`FtraceEventBundle.lost_events`][FtraceEventBundle] field. This allows
  to locate precisely the point where data loss happened.

At the TraceProcessor SQL level, this data is available in the `stats` table:

```sql
> select * from stats where name like 'ftrace_cpu_overrun_end'
name                 idx                  severity             source value
-------------------- -------------------- -------------------- ------ ------
ftrace_cpu_overrun_e                    0 data_loss            trace       0
ftrace_cpu_overrun_e                    1 data_loss            trace       0
ftrace_cpu_overrun_e                    2 data_loss            trace       0
ftrace_cpu_overrun_e                    3 data_loss            trace       0
ftrace_cpu_overrun_e                    4 data_loss            trace       0
ftrace_cpu_overrun_e                    5 data_loss            trace       0
ftrace_cpu_overrun_e                    6 data_loss            trace       0
ftrace_cpu_overrun_e                    7 data_loss            trace       0
```

These losses can be mitigated either increasing
[`TraceConfig.FtraceConfig.buffer_size_kb`][FtraceConfig]
 or decreasing 
[`TraceConfig.FtraceConfig.drain_period_ms`][FtraceConfig]

#### Shared memory losses

Tracing data can be lost in the shared memory due to bursts while traced is
blocked.

At the trace proto level, losses in this path are recorded:

* In [`TraceStats.BufferStats.trace_writer_packet_loss`][BufferStats].
* In [`TracePacket.previous_packet_dropped`][TracePacket].
  Caveat: the very first packet emitted by every data source is also marked as
  `previous_packet_dropped=true`. This is because the sevice has no way to
  tell if that was the truly first packet or everything else before that was
  lost.

At the TraceProcessor SQL level, this data is available in the `stats` table:
```sql
> select * from stats where name = 'traced_buf_trace_writer_packet_loss'
name                 idx                  severity             source    value
-------------------- -------------------- -------------------- --------- -----
traced_buf_trace_wri                    0 data_loss            trace         0
```

#### Central buffer losses

Data losses in the central buffer can happen for two different reasons:

1. When using `fill_policy: RING_BUFFER`, older tracing data is overwritten by
   virtue of wrapping in the ring buffer.
   These losses are recorded, at the trace proto level, in
   [`TraceStats.BufferStats.chunks_overwritten`][BufferStats].

2. When using `fill_policy: DISCARD`, newer tacing data committed after the
   buffer is full is dropped.
   These losses are recorded, at the trace proto level, in
   [`TraceStats.BufferStats.chunks_discarded`][BufferStats].

At the TraceProcessor SQL level, this data is available in the `stats` table,
one entry per central buffer:

```sql
> select * from stats where name = 'traced_buf_chunks_overwritten' or name = 'traced_buf_chunks_discarded'
name                 idx                  severity             source  value
-------------------- -------------------- -------------------- ------- -----
traced_buf_chunks_di                    0 info                 trace       0
traced_buf_chunks_ov                    0 data_loss            trace       0
```

Summary: the best way to detect and debug data losses is to use Trace Processor
and issue the query:
`select * from stats where severity = 'data_loss' and value != 0`

## Metadata invalidtaion

## Ordering

## Atomicity guarantees

[streaming mode]: /docs/recording/config#long-traces
[FtraceConfig]: /docs/reference/trace-config-proto#FtraceConfig
[FtraceCpuStats]: /docs/reference/trace-packet-proto#FtraceCpuStats
[FtraceEventBundle]: /docs/reference/trace-packet-proto#FtraceEventBundle
[TracePacket]: /docs/reference/trace-packet-proto#TracePacket
[BufferStats]: /docs/reference/trace-packet-proto#TraceStats.BufferStats