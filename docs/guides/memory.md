# Investigating Memory Usage on Android

## Prerequisites
This tutorial assumes you are running Android 11 or newer on your phone, and
Linux or macOS on your computer. If you are profiling your own app,
it needs to be marked as profileable or debuggable in its manifest. See the
[heapprofd documentation](/docs/recording/data-sources.md#heapprofd-targets) for more
details on which applications can be targeted.

`com.android.systemui` is marked as profileable on Android 11, so we use that
as an example.

## dumpsys meminfo
A good place to get started investigating memory usage of a process is
`dumpsys meminfo` which gives a high-level overview of how much of the various
types of memory are being used by a process.

```
$ adb shell dumpsys meminfo com.android.systemui

Applications Memory Usage (in Kilobytes):
Uptime: 2030149 Realtime: 2030149

** MEMINFO in pid 1974 [com.android.systemui] **
                   Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                 Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                ------   ------   ------   ------   ------   ------   ------   ------
  Native Heap    16840    16804        0     6764    19428    34024    25037     5553
  Dalvik Heap     9110     9032        0      136    13164    36444     9111    27333

[more stuff...]
```

Looking at the "Private Dirty" column of Dalvik Heap (= Java Heap) and
Native Heap, we can see that SystemUI's memory usage on the Java heap
is 9M, on the native heap it's 17M.

## Linux memory management
But what does *private* and *dirty* actually mean? To answer this question, we
need to delve into Linux memory management a bit.

From the kernel's point of view, memory is split into equally sized blocks
called *pages*. These are generally 4KiB. If an application asks for a new
set of continuous blocks, the kernel creates a new VMA (Virtual Memory Area).
The actual memory is only allocated (in page granularity) once the application
tries to write to it. If you allocate 5TiB worth of pages but only touch one
page, your process' memory usage will only go up by 4KiB. You will have
increased your process' *virtual memory* by 5TiB, but its memory resident
*physical memory* by 4KiB.

When optimizing memory use of programs, we are interested in reducing their
footprint in *physical memory*. High *virtual memory* use is generally not a
cause for concern (except if you run out of addresses, which is very hard on
64 bit systems).

We call the amount a process' memory that is resident in *physical memory* its
**RSS** (Resident Set Size). Not all memory is created equal though.
Memory in Linux can be described using a couple of binary labels.

* **anon / file:** anon memory does not exist on disk, file memory contains the
content of a file.
* **clean / dirty:** clean memory has not been written to by the process, or
the changes have been written back to the backing file. Dirty memory has been
written to and has not been written back to the backing file.
* **private / shared:** modifications to private memory are only seen by the
process doing it. Modifications to shared memory can be seen by other
processes or the underlying file.

Some memory that is resident can be *reclaimed* by the kernel if it wants to
free up memory.

<center>

| clean / dirty  | private / shared  | anon / file  | reclaimable |
|:-----:|:--------:|:----:|-------------|
| clean | private  | anon | reclaimable |
| clean | private  | file | reclaimable |
| clean | shared   | anon | reclaimable |
| clean | shared   | file | reclaimable |
| dirty | private  | anon | resident    |
| dirty | private  | file | resident    |
| dirty | shared   | anon | resident    |
| dirty | shared   | file | reclaimable |

</center>

Memory that is *clean* is reclaimable by the kernel in case of low system memory.
*Dirty* memory is always resident, except if it is *file*-backed and *shared*. In
that case it can be reclaimed by writing back the content to the file.

It is generally more important to reduce the amount of memory
that cannot be reclaimed, as reclaimable memory can be thought of as a cache
that the kernel can free up in case of low memory. This is why we looked at
*Private Dirty* in the `dumpsys meminfo` example.

*Shared* memory can be mapped into more than one process. This means VMAs in
different processes refer to the same physical memory. This introduces the
concept of **PSS** (Proportional Set Size). In **PSS**, memory that is
resident in multiple processes is proportionally attributed to each of them.
If we map one 4KiB page into four processes, each of their **PSS** will
increase by 1KiB.

## {#lmk} Low-memory kills
When an Android device becomes low on memory, a daemon called LMKD will
start killing unimportant processes in order to free up memory. Devices'
strategies differ, but in general processes will be killed in order of
decending `oom_score_adj` score.

App will remain *cached* even after the user finishes using them, to make
subsequent starts of the app faster. Such apps will generally be killed
first (because they have a higher `oom_score_adj`).

We can collect information about LMKs and `oom_score_adj` using Perfetto.

```
$ adb shell perfetto \
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
            ftrace_events: "lowmemorykiller/lowmemory_kill"
            ftrace_events: "oom/oom_score_adj_update"
            ftrace_events: "ftrace/print"
            atrace_apps: "lmkd"
        }
    }
}
duration_ms: 60000

EOF
```
Pull the file using `adb pull /data/misc/perfetto-traces/trace ~/oom-trace`
and upload to the [Perfetto UI](https://ui.perfetto.dev).


![OOM Score](/docs/images/oom-score.png)

We can see that the OOM score of Camera gets reduced (making it less likely
to be killed) when it is opened, and gets increased again once it is closed.

## Memory over time
`dumpsys meminfo` is good to get a snapshot of the current memory usage, but
even very short memory spikes can lead to low-memory situations, which will
lead to [LMKs](#lmk). We have two tools to investigate situations like this

* RSS High Watermark.
* Memory tracepoints.

### RSS High Watermark

We can get a lot of information from the `/proc/[pid]/status` file, including
memory information. `RssHWM` shows the maximum RSS usage the process has seen
since it was started.

```
$ adb shell cat '/proc/$(pidof com.android.systemui)/status'
[...]
VmPeak:	14995392 kB
VmSize:	14994624 kB
VmLck:	       0 kB
VmPin:	       0 kB
VmHWM:	  256972 kB
VmRSS:	  195272 kB
RssAnon:	   30184 kB
RssFile:	  164420 kB
RssShmem:	     668 kB
VmData:	 1310236 kB
VmStk:	    8192 kB
VmExe:	      28 kB
VmLib:	  158856 kB
VmPTE:	    1396 kB
VmPMD:	      76 kB
VmSwap:	   43960 kB
[...]
```

### Memory tracepoints

We can use Perfetto to get information about memory management events from the
kernel.

```
$ adb shell perfetto \
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
            ftrace_events: "mm_event/mm_event_record"
            ftrace_events: "kmem/rss_stat"
            ftrace_events: "kmem/ion_heap_grow"
            ftrace_events: "kmem/ion_heap_shrink"
        }
    }
}
duration_ms: 30000

EOF
```

While it is running, take a photo if you are following along.

Pull the file using `adb pull /data/misc/perfetto-traces/trace ~/mem-trace`
and upload to the [Perfetto UI](https://ui.perfetto.dev). This will show
overall stats about system [ION](#ion) usage, and per-process stats to
expand. Scroll down (or Ctrl-F for) to `com.google.android.GoogleCamera` and
expand. This will show a timeline for various memory stats for camera.

![Camera Memory Trace](/docs/images/trace-rss-camera.png)

We can see that around 2/3 into the trace, the memory spiked (in the
mem.rss.anon track). This is where I took a photo. This is a good way to see
how the memory usage of an application reacts to different triggers.

## {#heapprofd} Analyzing the Native Heap
**Native Heap Profiles require Android 10.**

_If your native memory is neglibile, you can skip ahead to
[Analyzing the Java Heap](#analyzing-the-java-heap)._

Applications usually get memory through `malloc` or C++'s `new` rather than
directly getting it from the kernel. The allocator makes sure that your memory
is more efficiently handled (i.e. there are not many gaps) and that the
overhead from asking the kernel remains low.

We can log the native allocations and frees that a process does using
*heapprofd*. The resulting profile can be used to attribute memory usage
to particular function callstacks, supporting a mix of both native and Java
code. The profile *will only show allocations done while it was running*, any
allocations done before will not be shown.

### Capturing the profile
Use the `tools/heap_profile` script to profile a process. If you are having
trouble make sure you are using the [latest version](
https://raw.githubusercontent.com/google/perfetto/master/tools/heap_profile).
See all the arguments using `tools/heap_profile -h`, or use the defaults
and just profile a process (e.g. `system_server`):

```
$ tools/heap_profile -n system_server

Profiling active. Press Ctrl+C to terminate.
You may disconnect your device.

Wrote profiles to /tmp/profile-1283e247-2170-4f92-8181-683763e17445 (symlink /tmp/heap_profile-latest)
These can be viewed using pprof. Googlers: head to pprof/ and upload them.
```

When you see *Profiling active*, play around with the phone a bit. When you
are done, press Ctrl-C to end the profile. For this tutorial, I opened a
couple of apps.

### Viewing the data
Then upload the `raw-trace` file from the output directory to the
[Perfetto UI](https://ui.perfetto.dev) and click on diamond marker that
shows.

![Profile Diamond](/docs/images/profile-diamond.png)

The tabs that are available are

* **space**: how many bytes were allocated but not freed at this callstack the
  moment the dump was created.
* **alloc\_space**: how many bytes were allocated (including ones freed at the
  moment of the dump) at this callstack
* **objects**: how many allocations without matching frees were sampled at this
  callstack.
* **alloc\_objects**: how many allocations (including ones with matching frees)
  were sampled at this callstack.

The default view will show you all allocations that were done while the
profile was running but that weren't freed (the **space** tab).

![Native Flamegraph](/docs/images/syssrv-apk-assets-two.png)

We can see that a lot of memory gets allocated in paths through
`ResourceManager.loadApkAssets`. To get the total memory that was allocated
this way, we can enter "loadApkAssets" into the Focus textbox. This will only
show callstacks where some frame matches "loadApkAssets".

![Native Flamegraph with Focus](/docs/images/syssrv-apk-assets-focus.png)

From this we have a clear idea where in the code we have to look. From the
code we can see how that memory is being used and if we actually need all of
it. In this case the key is the `_CompressedAsset` that requires uncompressing
into RAM rather than being able to (_cleanly_) memory-map. By not compressing
these data, we can save RAM.

## {#java-hprof} Analyzing the Java Heap
**Java Heap Dumps require Android 11.**

### Capturing the profile
We can get a snapshot of the graph of all the Java objects that constitute the
Java heap. We use the `tools/java_heap_dump` script.If you are having trouble
make sure you are using the [latest version](
https://raw.githubusercontent.com/google/perfetto/master/tools/java_heap_dump).

```
$ tools/java_heap_dump -n com.android.systemui

Dumping Java Heap.
Wrote profile to /tmp/tmpup3QrQprofile
This can be viewed using https://ui.perfetto.dev.
```

### Viewing the Data
TODO(fmayer): have an example that shows something interesting.

Upload the trace to the [Perfetto UI](https://ui.perfetto.dev) and click on
diamond marker that shows.

![Profile Diamond](/docs/images/profile-diamond.png)

This will present a flamegraph of the memory attributed to the shortest path
to a garbage-collection root. In general an object is reachable by many paths,
we only show the shortest as that reduces the complexity of the data displayed
and is generally the highest-signal. The rightmost `[merged]` stacks is the
sum of all objects that are too small to be displayed.

![Java Flamegraph](/docs/images/java-flamegraph.png)

The tabs that are available are

* **space**: how many bytes are retained via this path to the GC root.
* **objects**: how many objects are retained via this path to the GC root.

If we want to only see callstacks that have a frame that contains some string,
we can use the Focus feature. If we want to know all allocations that have to
do with notifications, we can put "notification" in the Focus box.

As with native heap profiles, if we want to focus on some specific aspect of the
graph, we can filter by the names of the classes. If we wanted to see everything
that could be caused by notifications, we can put "notification" in the Focus box.

![Java Flamegraph with Focus](/docs/images/java-flamegraph-focus.png)

We aggregate the paths per class name, so if there are multiple objects of the
same type retained by a `java.lang.Object[]`, we will show one element as its
child, as you can see in the leftmost stack above.
