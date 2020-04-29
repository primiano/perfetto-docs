# Quickstart: trace conversion

-------

_**TLDR**: This quickstart demonstrates how Perfetto traces can be converted into other trace formats using the `traceconv` tool._

## Prerequistes

NOTE: Alternatively, skip to [this section](/docs/TODO.md) to use the Perfetto UI to convert traces to the Chrome JSON format and open these traces in the legacy UI (Catapult's chrome://tracing).

- A device running macOS/Linux
- A Perfetto protobuf trace file

The supported output formats are:

- proto text format: the standard text based representation of protos
- Chrome JSON format: the format used by chrome://tracing
- systrace format: the ftrace text format used by Android systrace
- profile format (heap profiler only): pprof-like format. This is only valid for traces with [heap profiler](/src/profiling/memory/README.md) dumps

Setup
---------

To begin, download the `traceconv` [here](). (_Note: this script requries Python and downloads the correct native binary based on your platform._)

```console
$ chmod +x traceconv      # ensures that traceconv is executable 
$ ./traceconv [text|json|systrace|profile] [input proto file] [output file]
```

## Converting a perfetto trace to systrace text format

`./traceconv systrace [input proto file] [output systrace file]`

## Converting a perfetto trace to Chrome JSON format (for chrome://tracing)

`./traceconv json [input proto file] [output json file]`

## Opening a Perfetto trace in the legacy systrace UI

Navigate to ui.perfetto.dev and choose the "Open with legacy UI" option. This runs traceconv (the progress of which can be seen in the UI) and passes the converted trace seamlessly to chrome://tracing

