# CPU Scheduling events

Perfetto can show information about what threads were scheduled, on which cores they ran, for how long they ran, and what caused them to
scheduled and de-scheduled. Here is an example config:

```protobuf
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_waking"
    }
  }
}
```

CPU scheduling is the displayed in the most prominent tracks in the UI. When zoomed out the activity will be displayed in a bar graph as below:

![](/docs/images/cpu-bar-graphs.png)

But once zoomed in you can see the individual scheduling slices:

![](/docs/images/cpu-zoomed.png)

To investigate CPU scheduling from the `trace_processor` there is a specialised table called `sched`. You can query it as follows:

```sql
select * from sched where cpu = 0
```

A common use case might be to find the CPU time broken down by process. You can do this with the following query:

```sql
select process.name, tot_proc/1e9 as cpu_sec
from (
  select upid, sum(tot_thd) as tot_proc
  from (
    select utid, sum(dur) as tot_thd
    from sched
    group by utid
  )
  join thread using(utid)
  group by upid
)
join process using(upid)
order by cpu_sec desc
limit 100
```


## Scheduling chains and latency

You can track causality of scheduling transitions and analyse the latency using the following ftrace events: 

```protobuf
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            ftrace_events: "sched/sched_switch"
            ftrace_events: "power/suspend_resume"
            ftrace_events: "sched/sched_wakeup"
            ftrace_events: "sched/sched_wakeup_new"
            ftrace_events: "sched/sched_waking"
            ftrace_events: "sched/sched_process_exit"
            ftrace_events: "sched/sched_process_free"
            ftrace_events: "task/task_newtask"
            ftrace_events: "task/task_rename"
        }
    }
}
```

This will appear in the UI when a CPU slice is selected:

![](/docs/images/latency.png)

