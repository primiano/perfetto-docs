
# Power
This data source polls charge counters and instantaneous power draw from the battery power management IC. It also includes polling of on-device power rails on selected devices.

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


## CPU frequency & power states
Including the following events in your trace config will allow investigation of CPU frequency and idle time:

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

## Board Voltages & frequencies

The following ftrace events can be added to the trace config to capture board voltage and frequency changes from board sensors.

```protobuf
data_sources: {
    config {
        name: "linux.ftrace"
        ftrace_config {
            ftrace_events: "regulator/regulator_set_voltage"
            ftrace_events: "regulator/regulator_set_voltage_complete"
            ftrace_events: "power/clock_enable"
            ftrace_events: "power/clock_disable"
            ftrace_events: "power/clock_set_rate"
            ftrace_events: "power/suspend_resume"
        }
    }
```

