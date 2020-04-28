# Available data sources

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
visualization. *Tip: you might want to put `libart.so` as a "Hide regex" when
profiling apps.*

You can use the [Perfetto UI](https://ui.perfetto.dev) to visualize heap dumps.
Upload the `raw-trace` file in your output directory. You will see all heap
dumps as diamonds on the timeline, click any of them to get a flamegraph.

Alternatively [Speedscope](https://speedscope.app) can be used to visualize
the gzipped protos, but will only show the space view.
*Tip: Click Left Heavy on the top left for a good visualisation.*

### Sampling interval
heapprofd samples heap allocations. Given a sampling interval of n bytes,
one allocation is sampled, on average, every n bytes allocated. This allows to
reduce the performance impact on the target process. The default sampling rate
is 4096 bytes.

The easiest way to reason about this is to imagine the memory allocations as a
steady stream of one byte allocations. From this stream, every n-th byte is
selected as a sample, and the corresponding allocation gets attributed the
complete n bytes. As an optimization, we sample allocations larger than the
sampling interval with their true size.

To make this statistically more meaningful, Poisson sampling is employed.
Instead of a static parameter of n bytes, the user can only choose the mean
value around which the interval is distributed. This makes sure frequent small
allocations get sampled as well as infrequent large ones.

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

The Resulting `ProfileProto` will have `from_startup` set  to true in the
corresponding `ProcessHeapSamples` message. This does not get surfaced in the
converted pprof compatible proto.

### Runtime profiling
When a profile session is started, all matching processes (by name or PID)
are enumerated and profiling is enabled. The resulting profile will contain
all allocations done between the beginning and the end of the profiling
session.

The Resulting `ProfileProto` will have `from_startup` set  to false in the
corresponding `ProcessHeapSamples` message. This does not get surfaced in the
converted pprof compatible proto.

### Concurrent profiling sessions
If multiple sessions name the same target process (either by name or PID),
only the first relevant session will profile the process. The other sessions
will report that the process had already been profiled when converting to
the pprof compatible proto.

If you see this message but do not expect any other sessions, run
```
adb shell killall perfetto
```
to stop any concurrent sessions that may be running.


The Resulting `ProfileProto` will have `rejected_concurrent` set  to true in
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

```
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

### Known Issues

#### Android 10
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

### Manual instructions
*It is not recommended to use these instructions unless you have advanced
requirements or are developing heapprofd. Proceed with caution*

#### Download trace\_to\_text
Download the latest trace\_to\_text for [Linux](
https://storage.googleapis.com/perfetto/trace_to_text-4ab1d18e69bc70e211d27064505ed547aa82f919)
or [MacOS](https://storage.googleapis.com/perfetto/trace_to_text-mac-2ba325f95c08e8cd5a78e04fa85ee7f2a97c847e).
This is needed to convert the Perfetto trace to a pprof-compatible file.

Compare the `sha1sum` of this file to the one contained in the file name.

#### Start profiling
To start profiling the process `${PID}`, run the following sequence of commands.
Adjust the `INTERVAL` to trade-off runtime impact for higher accuracy of the
results. If `INTERVAL=1`, every allocation is sampled for maximum accuracy.
Otherwise, a sample is taken every `INTERVAL` bytes on average.


```bash
INTERVAL=4096

echo '
buffers {
  size_kb: 102400
}

data_sources {
  config {
    name: "android.heapprofd"
    target_buffer: 0
    heapprofd_config {
      sampling_interval_bytes: '${INTERVAL}'
      pid: '${PID}'
    }
  }
}

duration_ms: 20000
' | adb shell perfetto --txt -c - -o /data/misc/perfetto-traces/profile

adb pull /data/misc/perfetto-traces/profile /tmp/profile
```

#### Convert to pprof compatible file

While we work on UI support, you can convert the trace into pprof compatible
heap dumps.

Use the trace\_to\_text file downloaded above, with XXXXXXX replaced with the
`sha1sum` of the file.

```
trace_to_text-linux-XXXXXXX profile /tmp/profile
```

This will create a directory in `/tmp/` containing the heap dumps. Run

```
gzip /tmp/heap_profile-XXXXXX/*.pb
```

to get gzipped protos, which tools handling pprof profile protos expect.

Follow the instructions in [Viewing the Data](#viewing-the-data) to visualise
the results.

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
