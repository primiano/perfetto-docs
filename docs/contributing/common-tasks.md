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






