# Buffers and dataflow

This page describes the overall dataflow of trace data in Perfetto highlighting
... TODO the buffers involved and giving advice on how to size them.

Perfetto tracing is an asynchronous multiple-writer single-reader pipeline. In
many senses, its architecture is very similar to modern GPU's command buffers.

In a nutshell, the design philosophy is the following:

* Highly optimized for low-overhead writing.
* NOT optimized for low-latency reading.
* An IPC channel is used for synchronization and fencing of data writes if
  needed.

In the general case there are two types buffers involved in a perfetto trace:

![Buffers](/docs/images/buffers.png)

#### Central buffers

These buffers are defined by the user in the `buffers` section of the
[trace config](config.md). In the most simple cases, one tracing session =
one buffer, regardless of the number of data sources and producers.

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
tracing service, regardless of the number of data sources it hosts. This buffer
is a temporary staging buffer and has two purposes:

1. Allowing direct serialization of the data in a buffer that the tracing 
   service can read (i.e. zero-copy on the write path)

2. Decupling writes from reads of the tracing service.

The tracing service has the job of moving trace packets from the shared memory
buffer (blue) into the final memory buffer (yellow) as fast as it can.

The shared memory buffer hides the scheduling and response latencies of the
tracing service, allowing the producer to keep writing without losing data when
the tracing service is temporarily blocked.

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


## Life of a trace packet

Here is a step-by-step example to fully understand the dataflow of trace packets
across buffers. Let's assume a producer process with two data sources writing
packets at a different rate, both targeting the same central buffer.


## Debugging data losses.

## Metadata invalidtaion

## Ordering

## Atomicity guarantees


[streaming mode]: /docs/recording/config#long-traces