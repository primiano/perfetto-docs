# Quickstart: Trace conversion

_This quickstart demonstrates how Perfetto traces can be converted into other trace formats using the `traceconv` tool._

![](/docs/images/traceconv-summary.png)

## Prerequisites

NOTE: Alternatively, use the _"Open with legacy UI"_ link in the Perfetto UI to
convert traces to the Chrome JSON format and open these traces in the
chrome://tracing (also known as Catapult) UI.

- A device running macOS/Linux
- A Perfetto protobuf trace file

The supported output formats are:

- proto text format: the standard text based representation of protos
- Chrome JSON format: the format used by chrome://tracing
- systrace format: the ftrace text format used by Android systrace
- profile format (heap profiler only): pprof-like format. This is only valid for
  traces with [heap profiler](/docs/data-sources/native-heap-profiler.md) dumps.

## Setup

To begin, download the `traceconv` [here](). (_Note: this script requires Python and downloads the correct native binary based on your platform._)

```console
$ chmod +x traceconv      # ensures that traceconv is executable 
$ ./traceconv [text|json|systrace|profile] [input proto file] [output file]
```

## Converting to systrace text format

`./traceconv systrace [input proto file] [output systrace file]`

## Converting to Chrome JSON format (for chrome://tracing)

`./traceconv json [input proto file] [output json file]`

## Opening in the legacy systrace UI

Navigate to ui.perfetto.dev and choose the "Open with legacy UI" option. This runs traceconv (the progress of which can be seen in the UI) and passes the converted trace seamlessly to chrome://tracing

