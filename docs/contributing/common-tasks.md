# Common tasks

The checklists below show how to achieve some common tasks in the codebase.

## Add a new ftrace event

- Find the `format` file for your event. The location of the file depends where `tracefs` is mounted but can often be found at `sys/kernel/debug/tracing/events/EVENT_GROUP/EVENT_NAME/format`.
- Copy the format file into the codebase at `src/traced/probes/ftrace/test/data/synthetic/events/EVENT_GROUP/EVENT_NAME/format`.
- Add the event to [tools/ftrace_proto_gen/event_whitelist](/tools/ftrace_proto_gen/event_whitelist).
- Run `tools/run_ftrace_proto_gen`. This will update `protos/perfetto/trace/ftrace/ftrace_event.proto` and `protos/perfetto/trace/ftrace/GROUP_NAME.proto`.
- Run `tools/gen_all out/YOUR_BUILD_DIRECTORY`. This will update `src/traced/probes/ftrace/event_info.cc` and `protos/perfetto/trace/perfetto_trace.proto`.
- If special handling in `trace_processor` is desired update [src/trace_processor/importers/ftrace/ftrace_parser.cc](/src/trace_processor/importers/ftrace/ftrace_parser.cc) to parse the event.
- Upload and land your change as normal.

Here is an [example change](https://android-review.googlesource.com/c/platform/external/perfetto/+/1290645) which added the `ion/ion_stat` event.¢

## Add a new trace-based metric

* Create the proto file containing the metric in the [protos/perfetto/metrics](/protos/perfetto/metrics) folder. The appropriate` BUILD.gn` file should be updated as well.
* Import the proto in [protos/perfetto/metrics/metrics.proto](/protos/perfetto/metrics/metrics.proto) and add a field for the new message.
* Run `tools/gen_all out/YOUR_BUILD_DIRECTORY`. This will update the generated headers containing the descriptors for the proto.
  * *Note: this step has to be performed any time any metric-related proto is modified.1*
* Add a new SQL file for the metric to [src/trace_processor/metrics](/src/trace_processor/metrics). The appropriate `BUILD.gn` file should be updated as well.
  * To learn how to write new metrics, see the [trace-based metrics documentation](/docs/analaysis/metrics.md).
* Build all targets in your out directory with `tools/ninja -C out/YOUR_BUILD_DIRECTORY`.
* Add a test for the metric using `tools/add_tp_diff_test.sh`.
* Run the newly added test with `tools/diff_test_trace_processor.py <path to trace processor binary>`.
- Upload and land your change as normal.

