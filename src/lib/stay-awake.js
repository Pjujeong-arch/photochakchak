const { spawn, execFile } = require("child_process");

const ES_CONTINUOUS = 0x80000000;
const ES_SYSTEM_REQUIRED = 0x00000001;
const ES_DISPLAY_REQUIRED = 0x00000002;
const ES_AWAYMODE_REQUIRED = 0x00000040;
const HOLD = ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED | ES_AWAYMODE_REQUIRED;

function winPulse(flags) {
  const script = `
Add-Type @"
using System.Runtime.InteropServices;
public static class StayAwake {
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);
}
"@
[void][StayAwake]::SetThreadExecutionState(${flags >>> 0})
`;
  execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], () => {});
}

function holdCopyAwake() {
  if (process.platform === "win32") {
    winPulse(HOLD);
    const timer = setInterval(() => winPulse(HOLD), 25000);
    return {
      release() {
        clearInterval(timer);
        winPulse(ES_CONTINUOUS);
      },
    };
  }
  if (process.platform === "darwin") {
    const child = spawn("caffeinate", ["-dims"], { stdio: "ignore" });
    return {
      release() {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
      },
    };
  }
  const child = spawn(
    "systemd-inhibit",
    ["--what=idle:sleep", "--who=photochakchak", "--why=copy", "sleep", "infinity"],
    { stdio: "ignore" }
  );
  child.on("error", () => {});
  return {
    release() {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    },
  };
}

module.exports = { holdCopyAwake };
