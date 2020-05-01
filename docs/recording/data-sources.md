# Available data sources
Perfetto provides a number of built in data sources on Android and Linux.
These include [integration with Linux kernel tracing](#ftrace), [various process data](#process-stats) exposed via the `proc` filesystem, [logcat](#logcat) (Android only), [system data](#sys-stats) exposed by the `proc` filesystem, [native allocation profiling](#heapprofd), [Java heap graph dumps](#java-hprof) (Android only), and information about [power use](#power) (Android only).

This page will include some examples of how to enable different data sources in your trace. For a full explanation of trace configuration, see the [trace configuration](/docs/recording/config) page.

## Ftrace
Perfetto integrates with [Linux Kernel event tracing](https://www.kernel.org/doc/Documentation/trace/ftrace.txt).

This example config collects four Linux kernel events: 

```protobuf
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "ftrace/print"
      ftrace_events: "sched/sched_switch"
      ftrace_events: "task/task_newtask"
      ftrace_events: "task/task_rename"
    }
  }
}
```

A wildcard can be used to collect all events of a category:

```protobuf
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "ftrace/print"
      ftrace_events: "sched/*"
    }
  }
}
```
The full configuration options for ftrace can be seen in [ftrace_config.proto](/protos/perfetto/config/ftrace/ftrace_config.proto).

### CPU Scheduling
There is special support for the high volume events `sched/sched_switch` and `sched/sched_waking`, it can be enabled as follows:

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

To investigate the CPU scheduling from the `trace_processor` there is a specialised table call `sched`. You can query it as follows:

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

### CPU Frequency

Including the following events in your trace config with allow investigation of CPU frequency and idle time:

```protobuf
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            ftrace_events: "power/cpu_frequency"
            ftrace_events: "power/cpu_idle"
            ftrace_events: "power/suspend_resume"
        }
    }
}
```

This is displayed in the UI as a bar graph showing the frequency with idle states marked by the grey color.

![](/docs/images/cpu-frequency.png)

### Atrace Userspace Annotations

You can also enable atrace through Perfetto. 

![](/docs/images/userspace.png)

Add required categories to `atrace_categories` and set `atrace_apps` to a specific app to collect userspace annotations from that app.

```protobuf
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            atrace_categories: "view"
            atrace_categories: "webview"
            atrace_categories: "wm"
            atrace_categories: "am"
            atrace_categories: "sm"
            atrace_apps: "com.android.phone"
        }
    }
}
```

### Syscalls

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

## Process Stats

The process stats data source allows you to associate process names with the threads in the trace and collect per process data from `proc/<pid>/status` and `/proc/<pid>/oom_score_adj`.

![](/docs/images/proc_stat.png)

Process names are collected in the trace whenever a new thread is seen in a CPU scheduling event. To ensure thread/process association occurs even in traces with no scheduling data it is advisable to include `scan_all_processes_on_start = true` in your process stats config.

To collect process stat counters at every X ms set `proc_stats_poll_ms = X` in your process stats config. X must be greater than 100ms to avoid excessive CPU usage. Details about the specific counters being collected can be found in [process_stats.proto](/protos/perfetto/trace/ps/process_stats.proto).

Example config: 

```protobuf
data_sources: {
    config {
        name: "linux.process_stats"
        process_stats_config {
            scan_all_processes_on_start: true
            proc_stats_poll_ms: 1000
        }
    }
}
```

For more configuration options see [process_stats_config.proto](/protos/perfetto/config/process_stats/process_stats_config.proto). See [process_stats.proto](/protos/perfetto/trace/ps/process_stats.proto) and [process_tree.proto](/protos/perfetto/trace/ps/process_tree.proto) for more detailed information about all the information that can be collected.

The process/thread associations end up in the process and thread tables in the trace processor.
Run the following query to see them:

``` sql
select * from thread join process using(upid)
```

To investigate the per process counters using the `trace_processor` (rather than the UI as in the screenshot above) use the [process_counter_track](/docs/reference/sql-tables.md#process_counter_track). table.

TODO: Add example query for proc stat counters

## Logcat

Include Android Logcat messages in the trace and view them in conjunction with other trace data.

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

You may also want to add filtering on a tags using the filter_tags parameter or set a min priority to be included in the trace using min_prio. For details about configuration options, see [android\_log\_config.proto](/protos/perfetto/config/android/android_log_config.proto). 

The logs can be investigated along with other information in the trace using the [Perfetto UI](https://ui.perfetto.dev) as shown in the screenshot above.

If using the `trace_processor`, these logs will be in the [android\_logs](/docs/reference/sql-tables.md#android_logs) table. To look at the logs with the tag ‘perfetto’ you would use the following query:

```sql
select * from android_logs where tag = “perfetto”
```

## Sys Stats

This data source allows periodic polling of system data from 

- `proc/stat`
- `proc/vmstat`
- `proc/meminfo`

![](/docs/images/sys_stat_counters.png)

The polling period and specific counters to include in the trace can be set in the trace config.

```protobuf
data_sources: {
    config {
        name: "linux.sys_stats"
        sys_stats_config {
            meminfo_period_ms: 1000
            meminfo_counters: MEMINFO_MEM_TOTAL
            meminfo_counters: MEMINFO_MEM_FREE
            meminfo_counters: MEMINFO_MEM_AVAILABLE
            vmstat_period_ms: 1000
            vmstat_counters: VMSTAT_NR_FREE_PAGES
            vmstat_counters: VMSTAT_NR_ALLOC_BATCH
            vmstat_counters: VMSTAT_NR_INACTIVE_ANON
            vmstat_counters: VMSTAT_NR_ACTIVE_ANON
            stat_period_ms: 2500
            stat_counters: STAT_CPU_TIMES
            stat_counters: STAT_FORK_COUNT
        }
    }
}
```

All system counters can be seen in [sys\_stats\_counters.proto](/protos/perfetto/common/sys_stats_counters.proto).

When investigating a trace using the `trace_processor`, the counters can be found in the [`counter_track`](/docs/reference/sql-tables.md#counter_track) table.

TODO: Add example query

## Power

This data source polls charge counters and instantaneous power draw from the battery power management IC. It also includes polling of on-device power rails.

TODO: Add UI screenshot

The config required to enable this is:

```protobuf
data_sources: {
    config {
        name: "android.power"
        android_power_config {
            battery_poll_ms: 100
            collect_power_rails: true
            battery_counters: BATTERY_COUNTER_CAPACITY_PERCENT
            battery_counters: BATTERY_COUNTER_CHARGE
            battery_counters: BATTERY_COUNTER_CURRENT
        }
    }
}
```

For more details on the configuration options see [android\_power\_config.proto](/protos/perfetto/config/power/android_power_config.proto). The data output format can be seen in [battery\_counters.proto](/protos/perfetto/trace/power/battery_counters.proto) and [power_rails.proto](/protos/perfetto/trace/power/power_rails.proto).

When using `trace_processor` these counter will be in the `counter_track` table. To look at a specific counter use a query like:

TODO: insert example query

## Syscall tracing

## Inode Map

The inode map data source provides inode to filename resolution.

WARNING: Enabling this data source will negatively affect tracing performance.

```protobuf
data_sources: {
    config {
        name: "linux.inode_file_map"
        inode_file_config {
            scan_interval_ms: 1000
        }
    }
}
```

The configuration options can be found in [inode\_file\_config.proto](/protos/perfetto/config/inode_file/inode_file_config.proto). The output data format is specified in [inode\_file\_map.proto](/protos/perfetto/trace/filesystem/inode_file_map.proto).







## {#heapprofd} heapprofd - Android Heap Profiler

NOTE: **heapprofd requires Android 10.**

heapprofd is a tool that tracks native heap allocations & deallocations of an
Android process within a given time period. The resulting profile can be used
to attribute memory usage to particular function callstacks, supporting a mix
of both native and java code. The tool can be used by Android platform and app
developers to investigate memory issues.

On debug Android builds, you can profile all apps and most system services.
On "user" builds, you can only use it on apps with the debuggable or
profileable manifest flag.

### Quickstart
See the [Memory Guide](/docs/guides/memory.md#heapprofd) for getting started with
heapprofd.

### UI

Dumps from heapprofd are shown as flamegraphs in the UI after clicking on the
diamond.

![](/docs/images/profile-diamond.png)

![](/docs/images/native-flamegraph.png)

### Trace Processor
Information about callstacks is written to the following tables:
* [`stack_profile_mapping`](/docs/reference/sql-tables.md#stack_profile_mapping)
* [`stack_profile_frame`](/docs/reference/sql-tables.md#stack_profile_frame)
* [`stack_profile_callsite`](/docs/reference/sql-tables.md#stack_profile_callsite)

The allocations themselves are written to
[`heap_profile_allocation`](/docs/reference/sql-tables.md#heap_profile_allocation).

Offline symbolization data is stored in
[`stack_profile_symbol`](/docs/reference/sql-tables.md#stack_profile_symbol).

See [Example Queries](#heapprofd-example-queries) for example SQL queries.

### Recording
On Linux / MacOS, use the `tools/heap_profile` script to heap profile a
process. If you are having trouble make sure you are using the
[latest version](
https://raw.githubusercontent.com/google/perfetto/master/tools/heap_profile).

See all the arguments using `tools/heap_profile -h`.

You can also use the [Perfetto UI](https://ui.perfetto.dev/#!/record?p=memory)
to record heapprofd profiles. Tick "Heap profiling" in the trace configuration,
enter the processes you want to target, click "Add Device" to pair your phone,
and record profiles straight from your browser. This is also possible on
Windows.

See [the reference](/docs/reference/trace-config-proto.md#HeapprofdConfig) for
all available data source configuration when running `perfetto` manually.

### Viewing the data

The resulting profile proto contains four views on the data

* **space**: how many bytes were allocated but not freed at this callstack the
  moment the dump was created.
* **alloc\_space**: how many bytes were allocated (including ones freed at the
  moment of the dump) at this callstack
* **objects**: how many allocations without matching frees were done at this
  callstack.
* **alloc\_objects**: how many allocations (including ones with matching frees)
  were done at this callstack.

**Googlers:** Head to http://pprof/ and upload the gzipped protos to get a
visualization. 

TIP: you might want to put `libart.so` as a "Hide regex" when profiling apps.

You can use the [Perfetto UI](https://ui.perfetto.dev) to visualize heap dumps.
Upload the `raw-trace` file in your output directory. You will see all heap
dumps as diamonds on the timeline, click any of them to get a flamegraph.

Alternatively [Speedscope](https://speedscope.app) can be used to visualize
the gzipped protos, but will only show the space view.

TIP: Click Left Heavy on the top left for a good visualisation.

### Sampling interval
heapprofd samples heap allocations. Given a sampling interval of n bytes,
one allocation is sampled, on average, every n bytes allocated. This allows to
reduce the performance impact on the target process. The default sampling rate
is 4096 bytes.

The easiest way to reason about this is to imagine the memory allocations as a
steady stream of one byte allocations. From this stream, every byte has a 1/n
probability of being selected as a sample, and the corresponding callstack
gets attributed the complete n bytes. As an optimization, we sample allocations
larger than the sampling interval with their true size.

### Startup profiling
When a profile session names processes by name and a matching process is
started, it gets profiled from the beginning. The resulting profile will
contain all allocations done between the start of the process and the end
of the profiling session.

On Android, Java apps are usually not started, but the zygote forks and then
specializes into the desired app. If the app's name matches a name specified
in the profiling session, profiling will be enabled as part of the zygote
specialization. The resulting profile contains all allocations done between
that point in zygote specialization and the end of the profiling session.
Some allocations done early in the specialization process are not accounted
for.

The Resulting `ProfilePacket` will have `from_startup` set  to true in the
corresponding `ProcessHeapSamples` message. This does not get surfaced in the
converted pprof compatible proto.

### Runtime profiling
When a profile session is started, all matching processes (by name or PID)
are enumerated and profiling is enabled. The resulting profile will contain
all allocations done between the beginning and the end of the profiling
session.

The resulting `ProfilePacket` will have `from_startup` set to false in the
corresponding `ProcessHeapSamples` message. This does not get surfaced in the
converted pprof compatible proto.

### Concurrent profiling sessions
If multiple sessions name the same target process (either by name or PID),
only the first relevant session will profile the process. The other sessions
will report that the process had already been profiled when converting to
the pprof compatible proto.

If you see this message but do not expect any other sessions, run
```shell
adb shell killall perfetto
```
to stop any concurrent sessions that may be running.

The resulting `ProfilePacket` will have `rejected_concurrent` set  to true in
otherwise empty corresponding `ProcessHeapSamples` message. This does not get
surfaced in the converted pprof compatible proto.

### {#heapprofd-targets} Target processes
Depending on the build of Android that heapprofd is run on, some processes
are not be eligible to be profiled.

On user builds, only Java applications with either the profileable or the
debuggable manifest flag set can be profiled. Profiling requests for other
processes will result in an empty profile.

On userdebug builds, all processes except for a small blacklist of critical
services can be profiled (to find the blacklist, look for
`never_profile_heap` in [heapprofd.te](
https://cs.android.com/android/platform/superproject/+/master:system/sepolicy/private/heapprofd.te?q=never_profile_heap)).
This restriction can be lifted by disabling SELinux by running
`adb shell su root setenforce 0` or by passing `--disable-selinux` to the
`heap_profile` script.

<center>

|                         | userdebug setenforce 0 | userdebug | user |
|-------------------------|:----------------------:|:---------:|:----:|
| critical native service |            y           |     n     |  n   |
| native service          |            y           |     y     |  n   |
| app                     |            y           |     y     |  n   |
| profileable app         |            y           |     y     |  y   |
| debuggable app          |            y           |     y     |  y   |

</center>

To mark an app as profileable, put `<profileable android:shell="true"/>` into
the `<application>`.

```xml
<manifest ...>
    <application>
        <profileable android:shell="true"/>
        ...
    </application>
</manifest>
```

### DEDUPED frames
If the name of a Java method includes `[DEDUPED]`, this means that multiple
methods share the same code. ART only stores the name of a single one in its
metadata, which is displayed here. This is not necessarily the one that was
called.

### Manual dumping
You can trigger a manual dump of all currently profiled processes by running
`adb shell killall -USR1 heapprofd`. This can be useful for seeing the current
memory usage of the target in a specific state.

This dump will show up in addition to the dump at the end of the profile that is
always produced. You can create multiple of these dumps, and they will be
enumerated in the output directory.

### Symbolization
NOTE: **Symbolization is currently only available on Linux.**

#### Set up llvm-symbolizer
You only need to do this once.

To use symbolization, your system must have llvm-symbolizer installed and
accessible from `$PATH` as `llvm-symbolizer`. On Debian, you can install it
using `sudo apt install llvm-9`.
This will create `/usr/bin/llvm-symbolizer-9`. Symlink that to somewhere in
your `$PATH` as `llvm-symbolizer`.

For instance, `ln -s /usr/bin/llvm-symbolizer-9 ~/bin/llvm-symbolizer`, and
add `~/bin` to your path (or run the commands below with `PATH=~/bin:$PATH`
prefixed).

#### Symbolize your profile

If the profiled binary or libraries do not have symbol names, you can
symbolize profiles offline. Even if they do, you might want to symbolize in
order to get inlined function and line number information. All tools
(traceconv, trace_processor_shell, the heap_profile script) support specifying
the `PERFETTO_BINARY_PATH` as an environment variable.

```
PERFETTO_BINARY_PATH=somedir tools/heap_profile --name ${NAME}
```

You can persist symbols for a trace by running
`PERFETTO_BINARY_PATH=somedir tools/traceconv symbolize raw-trace > symbols`.
You can then concatenate the symbols to the trace (
`cat raw-trace symbols > symbolized-trace`) and the symbols will part of
`symbolized-trace`. The `tools/heap_profile` script will also generate this
file in your output directory, if `PERFETTO_BINARY_PATH` is used.

The symbol file is the first with matching Build ID in the following order:

1. absolute path of library file relative to binary path.
2. absolute path of library file relative to binary path, but with base.apk!
    removed from filename.
3. only filename of library file relative to binary path.
4. only filename of library file relative to binary path, but with base.apk!
    removed from filename.
5. in the subdirectory .build-id: the first two hex digits of the build-id
    as subdirectory, then the rest of the hex digits, with ".debug"appended.
    See
    https://fedoraproject.org/wiki/RolandMcGrath/BuildID#Find_files_by_build_ID

For example, "/system/lib/base.apk!foo.so" with build id abcd1234,
is looked for at
1. $PERFETTO_BINARY_PATH/system/lib/base.apk!foo.so
2. $PERFETTO_BINARY_PATH/system/lib/foo.so
3. $PERFETTO_BINARY_PATH/base.apk!foo.so
4. $PERFETTO_BINARY_PATH/foo.so
5. $PERFETTO_BINARY_PATH/.build-id/ab/cd1234.debug

### Troubleshooting

#### Buffer overrun
If the rate of allocations is too high for heapprofd to keep up, the profiling
session will end early due to a buffer overrun. If the buffer overrun is
caused by a transient spike in allocations, increasing the shared memory buffer
size (passing `--shmem-size` to heap\_profile) can resolve the issue.
Otherwise the sampling interval can be increased (at the expense of lower
accuracy in the resulting profile) by passing `--interval` to heap\_profile.

#### Profile is empty
Check whether your target process is eligible to be profiled by consulting
[Target processes](#target-processes) above.

Also check the [Known Issues](#known-issues).


#### Impossible callstacks
If you see a callstack that seems to impossible from looking at the code, make
sure no [DEDUPED frames](#deduped-frames) are involved.


#### Symbolization: Could not find library

When symbolizing a profile, you might come accross messages like this:

```
Could not find /data/app/invalid.app-wFgo3GRaod02wSvPZQ==/lib/arm64/somelib.so
(Build ID: 44b7138abd5957b8d0a56ce86216d478).
```

Check whether your library (in this example somelib.so) exists in
`PERFETTO_BINARY_PATH`. Then compare the Build ID to the one in your
symbol file, which you can get by running
`readelf -n /path/in/binary/path/somelib.so`. If it does not match, the
symbolized file has a different version than the one on device, and cannot
be used for symbolization.
If it does, try moving somelib.so to the root of `PERFETTO_BINARY_PATH` and
try again.

#### Only one frame shown
If you only see a single frame for functions in a specific library, make sure
that the library has unwind information. We need one of

* `.gnu_debugdata`
* `.eh_frame` (+ preferably `.eh_frame_hdr`)
* `.debug_frame`.

Frame-pointer unwinding is *not supported*.

To check if an ELF file has any of those, run

```console
$ readelf -S file.so | grep "gnu_debugdata\|eh_frame\|debug_frame"
  [12] .eh_frame_hdr     PROGBITS         000000000000c2b0  0000c2b0
  [13] .eh_frame         PROGBITS         0000000000011000  00011000
  [24] .gnu_debugdata    PROGBITS         0000000000000000  000f7292
```


If this does not show one or more of the sections, change your build system
to not strip them.

### Known Issues

#### Android 10
* On ARM32, the bottom-most frame is always `ERROR 2`. This is harmless and
  the callstacks are still complete.
* Does not work on x86 platforms (including the Android cuttlefish emulator).
* If heapprofd is run standalone (by running `heapprofd` in a root shell, rather
  than through init), `/dev/socket/heapprofd` get assigned an incorrect SELinux
  domain. You will not be able to profile any processes unless you disable
  SELinux enforcement.
  Run `restorecon /dev/socket/heapprofd` in a root shell to resolve.

### Ways to count memory

When using heapprofd and interpreting results, it is important to know the
precise meaning of the different memory metrics that can be obtained from the
operating system.

**heapprofd** gives you the number of bytes the target program
requested from the allocator. If you are profiling a Java app from startup,
allocations that happen early in the application's initialization will not be
visible to heapprofd. Native services that do not fork from the Zygote
are not affected by this.

**malloc\_info** is a libc function that gives you information about the
allocator. This can be triggered on userdebug builds by using
`am dumpheap -m <PID> /data/local/tmp/heap.txt`. This will in general be more
than the memory seen by heapprofd, depending on the allocator not all memory
is immediately freed. In particular, jemalloc retains some freed memory in
thread caches.

**Heap RSS** is the amount of memory requested from the operating system by the
allocator. This is larger than the previous two numbers because memory can only
be obtained in page size chunks, and fragmentation causes some of that memory to
be wasted. This can be obtained by running `adb shell dumpsys meminfo <PID>` and
looking at the "Private Dirty" column.

<center>

|                     | heapprofd         | malloc\_info | RSS |
|---------------------|:-----------------:|:------------:|:---:|
| from native startup |          x        |      x       |  x  |
| after zygote init   |          x        |      x       |  x  |
| before zygote init  |                   |      x       |  x  |
| thread caches       |                   |      x       |  x  |
| fragmentation       |                   |              |  x  |

</center>

If you observe high RSS or malloc\_info metrics but heapprofd does not match,
there might be a problem with fragmentation or the allocator.

### Convert to pprof
You can use
[traceconv](https://raw.githubusercontent.com/google/perfetto/master/tools/traceconv) to
convert the heap dumps in a trace into the [pprof](
https://github.com/google/pprof) format. These can then be viewed using
the pprof CLI or a UI (e.g. Speedscope, or Google-internally pprof/).

```shell
tools/traceconv profile /tmp/profile
```

This will create a directory in `/tmp/` containing the heap dumps. Run

```shell
gzip /tmp/heap_profile-XXXXXX/*.pb
```

to get gzipped protos, which tools handling pprof profile protos expect.

### {#heapprofd-example-queries} Example SQL Queries
<!--
echo 'select a.ts, a.upid, a.count, a.size, c.depth, c.parent_id, f.name, f.rel_pc, m.build_id, m.name from heap_profile_allocation a join stack_profile_callsite c ON (a.callsite_id = c.id) join stack_profile_frame f ON (c.frame_id = f.id) join stack_profile_mapping m ON (f.mapping = m.id) order by abs(size) desc;' | out/linux_clang_release/trace_processor_shell -q /dev/stdin /tmp/profile-0dd6cc73-05ad-4064-af05-82691adedb4c/raw-trace | head -n10 | sed 's/,/|/g'

-->

We can get the callstacks that allocated using an SQL Query in the
Trace Processor. For each frame we get one row for the number of allocated
bytes, where `count` and `size` is positive, and, if any of them were already
freed, another line with negative `count` and `size`. The sum of those gets us
the `space` view.

```sql
> select a.callsite_id, a.ts, a.upid, f.name, f.rel_pc, m.build_id, m.name as mapping_name,
         sum(a.size) as space_size, sum(a.count) as space_count
        from heap_profile_allocation a join
             stack_profile_callsite c ON (a.callsite_id = c.id) join
             stack_profile_frame f ON (c.frame_id = f.id) join
             stack_profile_mapping m ON (f.mapping = m.id)
        group by 1, 2, 3, 4, 5, 6, 7 order by space_size desc;
```

| callsite_id | ts | upid | name | rel_pc | build_id | mapping_name | space_size | space_count |
|-------------|----|------|-------|-----------|------|--------|----------|------|
|6660|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |106496|4|
|192 |5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |26624 |1|
|1421|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |26624 |1|
|1537|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |26624 |1|
|8843|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |26424 |1|
|8618|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |24576 |4|
|3750|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |12288 |1|
|2820|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |8192  |2|
|3788|5|1| malloc |244716| 8126fd.. | /apex/com.android.runtime/lib64/bionic/libc.so |8192  |2|

We can see all the functions are "malloc" and "realloc", which is not terribly
informative. Usually we are interested in the _cumulative_ bytes allocated in
a function (otherwise, we will always only see malloc / realloc). Chasing the
parent_id of a callsite (not shown in this table) recursively is very hard in
SQL.

There is an **experimental** table that surfaces this information. The **API is
subject to change**, so only use this in one-off situations.

```sql
> select name, map_name, cumulative_size
         from experimental_flamegraph(8300973884377,1,'native')
         order by abs(cumulative_size) desc;
```

| name | map_name | cumulative_size |
|------|----------|----------------|
|__start_thread|/apex/com.android.runtime/lib64/bionic/libc.so|392608|
|_ZL15__pthread_startPv|/apex/com.android.runtime/lib64/bionic/libc.so|392608|
|_ZN13thread_data_t10trampolineEPKS_|/system/lib64/libutils.so|199496|
|_ZN7android14AndroidRuntime15javaThreadShellEPv|/system/lib64/libandroid_runtime.so|199496|
|_ZN7android6Thread11_threadLoopEPv|/system/lib64/libutils.so|199496|
|_ZN3art6Thread14CreateCallbackEPv|/apex/com.android.art/lib64/libart.so|193112|
|_ZN3art35InvokeVirtualOrInterface...|/apex/com.android.art/lib64/libart.so|193112|
|_ZN3art9ArtMethod6InvokeEPNS_6ThreadEPjjPNS_6JValueEPKc|/apex/com.android.art/lib64/libart.so|193112|
|art_quick_invoke_stub|/apex/com.android.art/lib64/libart.so|193112|

## {#java-hprof} Java Heap Graphs

NOTE: **Java Heap Graphs require Android 11.**

### Quickstart
See the [Memory Guide](/docs/guides/memory.md#java-hprof) for getting started
with Java Heap Graphs.

### UI

Java Dumps are shown as flamegraphs in the UI after clicking on the
diamond.

![](/docs/images/profile-diamond.png)

![](/docs/images/java-flamegraph.png)

### Trace Processor
Information about the Java Heap is written to the following tables:
* [`heap_graph_class`](/docs/reference/sql-tables.md#heap_graph_class)
* [`heap_graph_object`](/docs/reference/sql-tables.md#heap_graph_object)
* [`heap_graph_reference`](/docs/reference/sql-tables.md#heap_graph_reference)

For instance, to get the bytes used by class name, run the following query.
This will usually be very generic, as most of the bytes in Java objects will
be in primitive arrays or Strings.

```sql
> select c.name, sum(o.self_size)
         from heap_graph_object o join
         heap_graph_class c on (o.type_id = c.id)
         where reachable = 1 group by 1 order by 2 desc;
```

|name                |sum(o.self_size)    |
|--------------------|--------------------|
|java.lang.String    |             2770504|
|long[]              |             1500048|
|int[]               |             1181164|
|java.lang.Object[]  |              624812|
|char[]              |              357720|
|byte[]              |              350423|

We can use `experimental_flamegraph` to normalize the graph into a tree, always
taking the shortest path to the root and get cumulative sizes.
Note that this is **experimental** and the **API is subject to change**, so
only use that for one-offs. From this we can see how much memory is being
hold on by objects of a type.

```sql
> select name, cumulative_size
  from experimental_flamegraph(56785646801, 1, 'graph')
  order by 2 desc;
```

| name | cumulative_size |
|------|-----------------|
|java.lang.String|1431688|
|java.lang.Class<android.icu.text.Transliterator>|1120227|
|android.icu.text.TransliteratorRegistry|1119600|
|com.android.systemui.statusbar.phone.StatusBarNotificationPresenter$2|1086209|
|com.android.systemui.statusbar.phone.StatusBarNotificationPresenter|1085593|
|java.util.Collections$SynchronizedMap|1063376|
|java.util.HashMap|1063292|
