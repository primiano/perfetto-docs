# Quickstart: trace-based metrics

_This quickstart demonstrates to run trace-based metrics using `trace_processor_shell`._

## Prerequistes

- A device running macOS/Linux
- A trace file in a [supported format](). [This trace]() is used throughout this guide.

Setup
---------

To begin, download the trace processor [here](). (_Note: this script requries Python and downloads the correct native binary based on your platform._)

Then, run the following

```console
$ chmod +x ./trace_processor       # ensures that trace processor is executable
```

Run a single metric
---------

To run a single metric, the `--run-metrics` flag can be used. The list of metrics available can be found [here](/docs/TODO.md). The default output is the protobuf text format.

NOTE: see [below](/docs/TODO.md) for alternative output formats (protobuf binary and JSON).

For example, to run the `android_cpu` metric

```console
$ ./trace_processor --run-metrics android_cpu trace.pftrace
android_cpu {
  process_info {
    name: "/system/bin/init"
    ...
  }
}
```

Running multiple metrics
---------

Multiple metrics can be flagged using comma separators to the `--run-metrics` flag. This will output a text proto with the combined result of running both metrics.

```console
$ ./trace_processor --run-metrics android_mem,android_cpu trace.pftrace
android_mem {
  process_metrics {
    process_name: ".dataservices"
    ...
  }
}
android_cpu {
  process_info {
    name: "/system/bin/init"
    ...
  }
}
```

JSON and binary output
---------

The trace processor also supports binary protobuf and JSON as alternative output formats. This is useful when the intended reader is an offline tool.

Both single and multiple metrics are supported as with proto text output.

```console
$ ./trace_processor --run-metrics android_mem --metrics-output=binary trace.pftrace
<binary protobuf output>

$ ./trace_processor --run-metrics android_mem,android_cpu --metrics-output=json trace.pftrace
{
  "android_mem": {
    ...
  },
  "android_cpu": {
    ...
  }
}
```

---------