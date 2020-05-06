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
    threads {
      name: "init"
      core {
        id: 1
        metrics {
          mcycles: 1
          runtime_ns: 570365
          min_freq_khz: 1900800
          max_freq_khz: 1900800
          avg_freq_khz: 1902017
        }
      }
      core {
        id: 3
        metrics {
          mcycles: 0
          runtime_ns: 366406
          min_freq_khz: 1900800
          max_freq_khz: 1900800
          avg_freq_khz: 1902908
        }
      }
      ...
    }
    ...
  }
  process_info {
    name: "/system/bin/logd"
    threads {
      name: "logd.writer"
      core {
        id: 0
        metrics {
          mcycles: 8
          runtime_ns: 33842357
          min_freq_khz: 595200
          max_freq_khz: 1900800
          avg_freq_khz: 1891825
        }
      }
      core {
        id: 1
        metrics {
          mcycles: 9
          runtime_ns: 36019300
          min_freq_khz: 1171200
          max_freq_khz: 1900800
          avg_freq_khz: 1887969
        }
      }
      ...
    }
    ...
  }
  ...
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
    total_counters {
      anon_rss {
        min: 19451904
        max: 19890176
        avg: 19837548.157829277
      }
      file_rss {
        min: 25804800
        max: 25829376
        avg: 25827909.957489081
      }
      swap {
        min: 9289728
        max: 9728000
        avg: 9342355.8421707246
      }
      anon_and_swap {
        min: 29179904
        max: 29179904
        avg: 29179904
      }
    }
    ...
  }
  ...
}
android_cpu {
  process_info {
    name: "/system/bin/init"
    threads {
      name: "init"
      core {
        id: 1
        metrics {
          mcycles: 1
          runtime_ns: 570365
          min_freq_khz: 1900800
          max_freq_khz: 1900800
          avg_freq_khz: 1902017
        }
      }
      ...
    }
    ...
  }
  ...
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
    "process_metrics": [
      {
        "process_name": ".dataservices",
        "total_counters": {
          "anon_rss": {
            "min": 19451904.000000,
            "max": 19890176.000000,
            "avg": 19837548.157829
          },
          "file_rss": {
            "min": 25804800.000000,
            "max": 25829376.000000,
            "avg": 25827909.957489
          },
          "swap": {
            "min": 9289728.000000,
            "max": 9728000.000000,
            "avg": 9342355.842171
          },
          "anon_and_swap": {
            "min": 29179904.000000,
            "max": 29179904.000000,
            "avg": 29179904.000000
          }
        },
        ...
      },
      ...
    ]
  }
  "android_cpu": {
    "process_info": [
      {
        "name": "\/system\/bin\/init",
        "threads": [
          {
            "name": "init",
            "core": [
              {
                "id": 1,
                "metrics": {
                  "mcycles": 1,
                  "runtime_ns": 570365,
                  "min_freq_khz": 1900800,
                  "max_freq_khz": 1900800,
                  "avg_freq_khz": 1902017
                }
              },
              ...
            ]
            ...
          }
          ...
        ]
        ...
      },
      ...
    ]
    ...
  }
}
```

## Next steps

There are a couple options to learn more about trace-based metrics:

- The [metrics documentation](/docs/TODO.md) gives a more in-depth look into metrics including a short walkthrough on how to build an experimental metric from scratch.
- The [metrics reference](/docs/TODO.md) gives a comprehensive list of all the available metrics including descriptions of their fields.
- The [common tasks](/docs/TODO.md) page gives a list of steps on how new metrics can be added to the trace processor.¢