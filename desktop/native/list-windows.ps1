param([uint32]$SelfPid = 0)

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class QiqiWin32 {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public static string Dump(uint self) {
    var sb = new StringBuilder();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      if (self != 0 && pid == self) return true;
      var t = new StringBuilder(512);
      if (GetWindowText(h, t, 512) == 0) return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int w = r.Right - r.Left;
      int hgt = r.Bottom - r.Top;
      if (w < 160 || hgt < 80) return true;
      string title = t.ToString().Replace("\t", " ").Replace("\r", " ").Replace("\n", " ");
      sb.Append(r.Left).Append('\t').Append(r.Top).Append('\t').Append(w).Append('\t').Append(hgt).Append('\t').Append(title).Append('\n');
      return true;
    }, IntPtr.Zero);
    return sb.ToString();
  }
}
"@

[QiqiWin32]::Dump($SelfPid)
