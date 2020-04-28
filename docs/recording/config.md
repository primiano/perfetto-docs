# Trace configuration

Unlike many always-on logging systems (e.g. Linux's rsyslog, Android's logcat),
in Perfetto all tracing data sources are idle by default and record data only
when instructed to do so.

Data sources record data only when one (or more) tracing sessions are active.
A tracing session is started by invoking the `perfetto` cmdline client and
passing a config (see QuickStart guide for [Android](/docs/TODO.md) or
[Linux](/docs/TODO.md)).

A simple trace config looks like this:

```protobuf
duration_ms: 10000

buffers {
  size_kb: 65536
  fill_policy: RING_BUFFER
}


data_sources {
  config {
    name: "linux.ftrace"
    target_buffer: 0
    ftrace_config {
      ftrace_events: "sched_switch"
      ftrace_events: "sched_wakeup"
    }
  }
}

````

And is used as follows:

```bash
perfetto --txt -c config.pbtx -o trace_file.pftrace
```

TIP: Some more complete examples of trace configs can be found in the repo in
[`/test/configs/`](/test/configs/).

## TraceConfig

The TraceConfig is a protobuf message
([reference docs](/docs/reference/trace-config-proto)) that defines:

1. The general behavior of the whole tracing system, e.g.:
    * The max duration of the trace.
    * The number of in-memory buffers and their size.
    * The max size of the output trace file.

2. Which data sources to enable and their configuration, e.g.:
    * For the [kernel tracring data source](/docs/TODO.md), which ftrace events
      to enable.
    * For the [heap profiler](/docs/TODO.md), the target process name and
      sampling rate.

NOTE: See the [data sources page](/docs/recording/data-sources.md) for details
      on how to configure the data sources bundled with Perfetto.

3. The `{data source} x {buffer}` mappings: which buffer each data
    source should write into (see [buffers section](#buffers) below).

The tracing service (`traced`) acts as a configuration dispatcher: it receives
a config from the `perfetto` cmdline client (or any other [Consumer](/docs/TODO.md))
and forwards parts of the config to the various [Producers](/docs/TODO.md)
connected.

When a tracing session is started by a consumer, the tracing service will:

* Read the outer section of the TraceConfig (e.g. `duration_ms`, `buffers`) and
  use that to determine its own behavior.
* Read the list of data sources in the `data_sources` section. For each data
  source listed in the config, if a corresponding name (`"linux.ftrace"` in the
  example below) was registered, the service will ask the producer process to
  start that data source, passing it the raw bytes of the
[`DataSourceConfig` subsection](/docs/reference/trace-config-proto#DataSourceConfig)
verbatim to the data source (See [backward/forward compat section](#abi) below).

![TraceConfig diagram](/docs/images/trace_config.png)

## Buffers

The buffer sections define the number, size and policy of the in-memory buffers
owned by the tracing service. It looks as follows:

```protobuf
// Buffer #0
buffers {
  size_kb: 4096
  fill_policy: RING_BUFFER
}

// Buffer #1
buffers {
  size_kb: 8192
  fill_policy: DISCARD
}

```

Each buffer has a fill policy which is either:

* RING_BUFFER (default): the buffer behaves like a ring buffer and writes when
  full will wrap over and replpace the oldest trace data in the buffer.

* DISCARD: the buffer stops accepting data once full. Further write attempts are
  dropped on the floor.

WARNING: DISCARD can have unexpected side-effect with data sources that commit
data at the end of the trace, see [Advanced topics](#advanced)

A trace config must define at least one buffer to be valid. In the simplest case
all data sources will write their trace data into the same buffer.

 While this is
fine for most basic cases, it can be problematic in cases where different data
sources write at significantly different rates.

For instance, imagine a trace config that enables both:

1. The kernel scheduler tracer. On a tyipcal Android phone this records
   ~10000 events/second, writing ~1 MB/s of trace data into the buffer.

2. Memory stat polling. This data source writes the contents of /proc/meminfo
   into the trace buffer and is configured to poll every 5 seconds, writing 
   ~100 KB per poll interval.

If both data sources are configured to write into the same buffer and such
buffer is set to 4MB, most traces will contain only one memory snapshot. There
are very good chances that most traces won't contain any memory snapshot at all,
even if the 2nd data sources was working perfectly.
This is because during the 5 s. polling interval, the scheduler data source can
end up filling the whole buffer, pushing the memory snapshot data out of the
buffer.

## Dynamic buffer mapping

Data-source <> buffer mappings are dynamic in Perfetto.
In the simplest case a tracing session can define only one buffer. By default,
all data sources will record data into that one buffer.

In cases like the example above, it might be preferrable separating these data
sources into different buffers.
This can be achieved with the `target_buffer` field of the TraceConfig.

![Buffer mapping](/docs/images/trace_config_buffer_mapping.png)

Can be achieved with:

```protobuf
data_sources {
  config {
    name: "linux.ftrace"
    target_buffer: 0       // <-- This goes into buffer 0.
    ftrace_config { ... }
  }
}

data_sources: {
  config {
      name: "linux.sys_stats"
      target_buffer: 1     // <-- This goes into buffer 1.
      sys_stats_config { ... }
  }
}

data_sources: {
  config {
    name: "android.heapprofd"
    target_buffer: 1       // <-- This goes into buffer 1 as well.
    heapprofd_config { ... }
  }
}
```

## PBTX vs binary format

There are two ways to pass the trace config when using the `perfetto` cmdline
client:

#### Text format

It is the preferred format for human-driven workflows and exploration. It
allows to pass directly the text file in the PBTX (ProtoBuf TeXtual
representation) syntax, for the schema defined in the
[trace_config.proto](/protos/perfetto/config/trace_config.proto)
(see [reference docs](/docs/reference/trace-config-proto))

When using this mode pass the `--txt` flag to `perfetto` to indicate the config
should be intepreted as a PBTX file:

```bash
perfetto -c /path/to/config.pbtx --txt -o trace_file.pftrace
```

NOTE: The `--txt` option has been introduced only in Android 10 (Q). Older
versions support only the binary format.

WARNING: Do not use the text format for machine-to-machine interaction
benchmark, scripts and tools) as it's more prone to breakages (e.g. if a field
is renamed or an enum is turned into an integer)

#### Binary format

It is the preferred format for machine-to-machine (M2M) interaction. It involves
passing the protobuf-encoded bynary of the TraceConfig message.
This can be obtained passing the PBTX in input to the protobuf's `protoc`
compiler (which can be downloaded
[here](https://github.com/protocolbuffers/protobuf/releases)).

```bash
cd ~/code/perfetto  # external/perfetto in the Android tree.

protoc --encode=perfetto.protos.TraceConfig \
        -I. protos/perfetto/config/perfetto_config.proto \
        < config.txpb \
        > config.bin
```

and then passing it to perfetto as follows, without the `--txt` argument:

```bash
perfetto -c config.bin -o trace_file.pftrace
```

## Streaming long traces

By default Perfetto keeps the full trace buffer(s) in memory and writes it into
the destination file (the `-o` cmdline argument) only at the end of the tracing
session. This is to reduce the perf-intrusiveness of the tracing system.
This, however, limits the max size of the trace to the physical memory size of
the device, which is often too limiting.

In some cases (e.g., benchmarks, hard to repro cases) it is desirable to capture
traces that are way larger than that, at the cost of extra I/O overhead.

To achieve that, Perfetto allows to periodically write the trace buffers into
the target file (or stdout) using the following TraceConfig fields:

* `write_into_file (bool)`:
When true drains periodically the trace buffers into the output
file. When this option is enabled, the userspace buffers need to be just
big enough to hold tracing data between two write periods.
The buffer sizing depends on the activity of the device.
The data rate of a typical trace is ~1-4 MB/s. So a 16MB in-memory buffer can
hold for up write periods of ~4 seconds before starting to lose data.

* `file_write_period_ms (uint32)`:
Overrides the default drain period (5s). Shorter periods require a smaller
userspace buffer but increase the performance intrusiveness of tracing. The
tracing service will ignore periods too small (< 100ms).

* `max_file_size_bytes (uint64)`:
If set, stops the tracing session after N bytes have been written. Used to
cap the size of the trace.

For a complete example of a working trace config in long-tracing mode see
[`/test/configs/long_trace.cfg`](/test/configs/long_trace.cfg).


## Triggers

## Backwards / forward compat

## Extensions

## {#advanced} Advanced topics

### DISCARD and flushes

## Other resources

* Reference
* Per-data source configs
* libprotobuf

