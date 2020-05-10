# System calls
The enter and exit of all syscalls can be tracked in Perfetto traces.

![](/docs/images/sys-calls.png)

The following ftrace events need to added to the trace config to collect syscalls.

```protobuf
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            ftrace_events: "raw_syscalls/sys_enter"
            ftrace_events: "raw_syscalls/sys_exit"
        }
    }
}
```
