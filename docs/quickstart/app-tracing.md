# App Instrumentation

The Perfetto Client API is a C++ library that allows applications to emit trace events to add more context to a Perfetto trace to help with development, debugging and performance analysis.

TIP: The code from this example is also available as a [GitHub repository](https://github.com/skyostil/perfetto-sdk-example).

To start using the Client API, first check out the latest SDK release:

```sh
$ git clone https://android.googlesource.com/platform/external/perfetto -b latest
```

The SDK consists of two files, `sdk/perfetto.h` and `sdk/perfetto.cc`. These are an amalgamation of the Client API designed to easy to integrate to existing build systems. For example, to add the SDK to a CMake project, edit your CMakeLists.txt accordingly:

```cmake
cmake_minimum_required(VERSION 3.13)
project(PerfettoExample)
find_package(Threads)

# Define a static library for Perfetto.
include_directories(perfetto/sdk)
add_library(perfetto STATIC perfetto/sdk/perfetto.cc)

# Link the library to your main executable.
add_executable(example example.cc)
target_link_libraries(example perfetto ${CMAKE_THREAD_LIBS_INIT})
```

Next, initialize Perfetto in your program:

```C++
#include <perfetto.h>

int main(int argv, char** argc) {
  perfetto::TracingInitArgs args;

  // The backends determine where trace events are recorded. You may select one
  // or more of:

  // 1) The in-process backend only records within the app itself.
  args.backends |= perfetto::kInProcessBackend;

  // 2) The system backend writes events into a system Perfetto daemon,
  //    allowing merging app and system events (e.g., ftrace) on the same
  //    timeline. Requires the Perfetto `traced` daemon to be running (e.g.,
  //    on Android Pie and newer).
  args.backends |= perfetto::kSystemBackend;

  perfetto::Tracing::Initialize(args);
}
```

You are now ready to instrument your app with trace events.
This example uses track events which represent time-bounded operations (e.g. function calls) on a timeline. For more advanced trace events, including custom data sources, see the full app instrumentation docs.

A typical use case for track events is annotating a function with a scoped track event, so that function’s execution shows up in a trace. To start using track events, first define the set of categories that your events will fall into. Each category can be separately enabled or disabled for tracing (see Category configuration).

Add the list of categories into a header file (e.g., `example_tracing.h`) like this:

```C++
#include <perfetto.h>

PERFETTO_DEFINE_CATEGORIES(
    perfetto::Category("rendering")
        .SetDescription("Events from the graphics subsystem"),
    perfetto::Category("network")
        .SetDescription("Network upload and download statistics"));
```
Then, declare static storage for the categories in a cc file (e.g. `example_tracing.cc`):

```C++
#include "example_tracing.h"

PERFETTO_TRACK_EVENT_STATIC_STORAGE();
```

Finally, initialize track events after the client library is brought up:

```C++
int main(int argv, char** argc) {
  ...
  perfetto::Tracing::Initialize(args);
  perfetto::TrackEvent::Register();  // Add this.
}
```

Now you can add track events to existing functions like this:

```
#include "example_tracing.h"

void DrawPlayer() {
  TRACE_EVENT("rendering", "DrawPlayer");
  ...
}
```

You are ready to record a trace!

To include your new track events in the trace, ensure that the `track_event` data source is included in the config. If you do not specify any categories then all non-debug categories will be included by default. However, you can also add just the categories you are interested in like so:

TODO: Check if this is correct

```protobuf
data_sources {
  config {
    name: "track_event"
    track_event_config {
    	enabled_categories: "rendering"
    }
  }
}
```

TODO: Add tracing with the Client API instructions here?



