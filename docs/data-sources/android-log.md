# Android Log

Include Android log messages in the trace and view them in conjunction with
other trace data.

![](/docs/images/android_logs.png)

You can configure which log buffers are included in the trace. If no buffers are specified, all will be included.

```protobuf
data_sources: {
    config {
        name: "android.log"
        android_log_config {
            log_ids: LID_DEFAULT
            log_ids: LID_SYSTEM
            log_ids: LID_CRASH
        }
    }
}
```

You may also want to add filtering on a tags using the `filter_tags` parameter or set a min priority to be included in the trace using `min_prio`.
For details about configuration options, see [android\_log\_config.proto](/protos/perfetto/config/android/android_log_config.proto). 

The logs can be investigated along with other information in the trace using the [Perfetto UI](https://ui.perfetto.dev) as shown in the screenshot above.

If using the `trace_processor`, these logs will be in the [android\_logs](/docs/reference/sql-tables.md#android_logs) table. To look at the logs with the tag ‘perfetto’ you would use the following query:

```sql
select * from android_logs where tag = "perfetto" order by ts
```

