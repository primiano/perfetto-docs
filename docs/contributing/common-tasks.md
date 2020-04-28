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

Here is an [example change](https://android-review.googlesource.com/c/platform/external/perfetto/+/1290645) which added the `ion/ion_stat` event.

## Add a new trace-based metric

* Create the proto file containing the metric in the [protos/perfetto/metrics](/protos/perfetto/metrics) folder. The appropriate` BUILD.gn` file should be updated as well.
* Import the proto in [protos/perfetto/metrics/metrics.proto](/protos/perfetto/metrics/metrics.proto) and add a field for the new message.
* Run `tools/gen_all out/YOUR_BUILD_DIRECTORY`. This will update the generated headers containing the descriptors for the proto.
  * *Note: this step has to be performed any time any metric-related proto is modified.1*
* Add a new SQL file for the metric to [src/trace_processor/metrics](/src/trace_processor/metrics). The appropriate `BUILD.gn` file should be updated as well.
  * To learn how to write new metrics, see the [trace-based metrics documentation](/docs/analysis/metrics.md).
* Build all targets in your out directory with `tools/ninja -C out/YOUR_BUILD_DIRECTORY`.
* Add a new diff test for the metric. This can be done by adding files to the [test/metrics](/test/metrics) folder and modifying the [index file](/test/metrics/index).
* Run the newly added test with `tools/diff_test_trace_processor.py <path to trace processor binary>`.
* Upload and land your change as normal.

Here is an [example change](https://android-review.googlesource.com/c/platform/external/perfetto/+/1290643) which added the `time_in_state` metric.

## Add a new trace processor table

* Create the new table in the appropriate header file in [src/trace_processor/tables](/src/trace_processor/tables) by copying one of the existing macro definitions.
  * Make sure to understand whether a root or derived table is needed and copy the appropriate one. For more information see the [trace processor](/docs/analysis/trace-processor.md) and [analysis](/docs/analysis/index.md) documentation.
* Register the table with the trace processor in the constructor for the [TraceProcessorImpl class](/src/trace_processor/trace_processor_impl.cc).
* If also implementing ingestion of events into the table:
  * Modify the appropriate parser class in [src/trace_processor/importers](/src/trace_processor/importers) and add the code to add rows to the newly added table.
  * Add a new diff test for the added parsing code and table using `tools/add_tp_diff_test.sh`.
    * Make sure to modify the [index file](/test/trace_processor/index) to correctly organize the test with other similar tests.
  * Run the newly added test with `tools/diff_test_trace_processor.py <path to trace processor binary>`.
* Upload and land your change as normal.