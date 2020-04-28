# Configuring perfetto

Unlike many always-on logging systems (e.g. Linux's rsyslog, Android's logcat),
in Perfetto all tracing data sources are idle by default and record data only
when instructed to do so.

Data sources record data only when one (or more) tracing sessions are active.
A tracing session is started by invoking the `perfetto` cmdline client and
passing a config (see QuickStart guide for [Android](/docs/TODO.md) or
[Linux](/docs/TODO.md)).

```bash
$ cat /path/to/config
# An extremely simple TraceConfig which won't record too much
duration_ms: 3000
```

And then:

```bash
perfetto --txt -c /path/to/config -o /path/to/output.pftrace
```

## TraceConfig

The TraceConfig is a protobuf message
([reference docs](/docs/reference/trace-config-proto)) that defines:

1. The general behavior of the whole tracing system, e.g.:
    * The max duration of the trace.
    * The number of in-memory buffers and their size.
    * The max size of final trace file.

2. Which data sources to enable and their configuration, e.g.:
    * For the [kernel tracing data source](/docs/TODO.md), which ftrace events
      to enable.
    * For the [heap profiler](/docs/TODO.md), the target process name and
      sampling rate.

3. The `{data source} x {buffer}` data routing matrix: which buffer each data
    source should write into (see [buffers section](#buffers) below).

The tracing service (`traced`) acts as a configuration dispatcher: it receives
a config from the `perfetto` cmdline client (or any other [Consumer](/docs/TODO.md))
and forwards parts of the config to the various [Producers](/docs/TODO.md)
connected.

When a tracing session is started by a consumer, the tracing service will:

* Read the outer section of the TraceConfig (e.g. `duration_ms`, `buffers`) and
  use that to determine its own behavior.
* Read the list of data sources in the `data_sources` section.

For each data source listed in the config, if a corresponding name (
`"linux.ftrace"` in the example of the picture below) was registered, `traced`
will ask the producer process to start that data source.
While doing so, it will pass the raw bytes of the
[`DataSourceConfig` subsection](/docs/reference/trace-config-proto#DataSourceConfig)
verbatim to the data source (See [backward/forward compat section](#abi) below).

![TraceConfig diagram](/docs/images/trace_config.png)

## Sample trace configs

A full list of working samples can be found in the
[`test/configs/`](/test/configs/) directory of the repo. A sample config looks
like this:

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

## PBTX vs binary format

When invoking the `perfetto` cmdline option the trace config can be passed in
two different ways:

### Text format

This is the preferred format for human-driven workflows and exploration. It
allows to pass directly the text file in the PBTX (ProtoBuf TeXtual
representation) syntax, for the schema defined in the
[trace_config.proto](/protos/perfetto/config/trace_config.proto)
(see [reference docs](/docs/reference/trace-config-proto))

When using this mode pass the `--txt` flag to `perfetto` to indicate the config
should be intepreted as a PBTX file, e.g:

`perfetto -c /path/to/config.pbtx --txt ...`

NOTE: The `--txt` has been introduced only in Android 10 (Q). Prior versions
of perfetto support only the binary mode.



## Other stuff

The trace config specifies things like:

proto vs txt file

Every trace start... config
consumer

Sections:
general:

per-data source

per-producer same data source name

in memory vs file flushing

ring buffer modes

flushed 

muxing buffers

backwards forward compat

Overlapping tracing sessions 

versioning

extensibility

## TraceConfig



## Recording long traces

