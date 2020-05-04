# Quickstart: system tracing on Linux

This page covers building perfetto's tracing binaries from source, using them to capture a trace with process scheduling data, and inspecting the latter in the web UI.

## Building from source

1. Check out the code:
```
git clone https://android.googlesource.com/platform/external/perfetto/ && cd perfetto
```

1. Download additional build dependencies (libraries and tools):
```
tools/install-build-deps
```
_If the script fails with SSL errors, try invoking it as `python3 tools/install-build-deps`, or upgrading your openssl libraries._

1. Generate all typical build configurations:
```
tools/build_all_configs.py
```

1. Build the Linux tracing binaries (using a pinned clang version, downloaded as part of build dependencies):
```
tools/ninja -C out/linux_clang_release traced traced_probes perfetto
```
_This step is optional, as the convenience script used below will (re)build the binaries if necessary._

## Capturing a trace

We can now use a convenience script to start the tracing binaries (`traced`, `traced_probes`), and capture a trace by running the `perfetto` commandline tool with a tracing configuration as an input. As an example, let's look at the process scheduling data, which will be obtained from the Linux kernel via the [ftrace](https://www.kernel.org/doc/Documentation/trace/ftrace.txt) interface.

1. Run the convenience script with an example tracing config (10 second duration):
```
OUT=out/linux_clang_release CONFIG=test/configs/scheduling.cfg tools/tmux -n
```
This will open a tmux window with three panes, one per the binary involved in tracing: `traced` - central tracing service, `traced_probes` - producer process which will be reading and re-encoding the ftrace data, `perfetto` - commandline tool acting as the requester and consumer of the trace. 

1. Start the tracing session by running the pre-filled `perfetto` command in the [consumer] pane.
1. Detach from the tmux session with `ctrl-b d` (or shut it down with `tmux kill-session -t demo`). The script should then copy the trace to `/tmp/trace.protobuf`, as a serialized protobuf.

## Visualizing the trace

We can now explore the captured trace visually by using a dedicated web-based UI.

NOTE: The UI runs in-browser using WASM, the trace is **not** uploaded anywhere by default (unless you explicitly share it via the menu).

1. Navigate to [ui.perfetto.dev](https://ui.perfetto.dev) in a browser.
1. Click the **Open trace file** on the left-hand menu, and load the captured trace (by default at `/tmp/trace.protobuf`).
1. Explore the trace by zooming/panning using WASD, and mouse for expanding process tracks (rows) into their constituent thread tracks. Press "?" for further navigation controls.

Alternatively, we could have explored the trace with raw SQL queries, using the underlying [Trace processor](/docs/analysis/trace-processor) directly.

TODO: include a screenshot of a loaded trace above.

## Next steps

TODO: fill this section with links to "learn more about the concepts", "put your own config together using the UI", "analyze traces via queries", etc.

