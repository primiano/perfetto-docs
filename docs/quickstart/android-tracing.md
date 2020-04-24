# System Tracing on Android
------
`perfetto` enables you to collect performance information from your Android devices. 
These traces contain data collected from a variety of sources such as:

* `ftrace` for information from the kernel
* `atrace` for user-space annotations from services and apps
* `heapprofd` for native memory usage information 

You can collect a trace in the following ways:

* Through the record page in the [Perfetto UI](https://ui.perfetto.dev).
* Using the `perfetto` CLI.

##Perfetto UI

Navigate to ui.perfetto.dev and select **Record new trace**.

From this page, select and turn on the data sources you want to include in the trace. More detail about the different data sources can be found [here](TODO add link).

![Record page of the Perfetto UI](/docs/images/record-trace.png)

If you are unsure, start by turning on **Scheduling details** under the **Cpu** tab.

Ensure your device is connected and select **Add ADB device**. Once your device has successfully paired (you may need to allow USB debugging on the device), select the **Start Recording** button.

Allow time for the trace to be collected (10s by default) and then you should see the trace appear.

![Perfetto UI with a trace loaded](/docs/images/trace-view.png)

Your trace may look different depending on which data sources you enabled.

##Perfetto CLI

If you are familiar with `systrace`, `perfetto` can be used in a similar way.

For example:

```
adb shell perfetto -o mytrace.pftrace -t 20s sched freq idle am wm gfx view \
    binder_driver hal dalvik camera input res
```

Any ftrace group or atrace category can be used in this command.

To include other data sources or tweak different parameters, you will need to pass a config file.

```
adb shell perfetto \
  -c - --txt \
  -o /data/misc/perfetto-traces/trace \
<<EOF

buffers: {
    size_kb: 8960
    fill_policy: DISCARD
}
buffers: {
    size_kb: 1280
    fill_policy: DISCARD
}
data_sources: {
    config {
        name: "linux.process_stats"
        target_buffer: 1
        process_stats_config {
            scan_all_processes_on_start: true
        }
    }
}
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            ftrace_events: "sched/sched_switch"
            ftrace_events: "power/suspend_resume"
            ftrace_events: "sched/sched_process_exit"
            ftrace_events: "sched/sched_process_free"
            ftrace_events: "task/task_newtask"
            ftrace_events: "task/task_rename"
            ftrace_events: "ftrace/print"
            atrace_categories: "gfx"
            atrace_categories: "view"
            atrace_categories: "webview"
            atrace_categories: "camera"
            atrace_categories: "dalvik"
            atrace_categories: "power"
        }
    }
}
duration_ms: 10000

EOF 
```

The full reference for the Perfetto CLI can be found [here](/docs/reference/perfetto-cli.md).




