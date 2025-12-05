//go:build windows

package cli

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"

	win "golang.org/x/sys/windows"
)

// setProcAttr 设置进程属性（Windows 版本）
// 创建新的进程组，以便可以通过进程组杀死所有子进程
func setProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// 创建新的进程组
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}

// killProcessGroup 杀死进程组（Windows 版本）
// 先尝试发送 CTRL_BREAK_EVENT，随后用 taskkill 兜底
func killProcessGroup(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	// 尝试向进程组发送 Ctrl+Break，优雅退出
	_ = win.GenerateConsoleCtrlEvent(win.CTRL_BREAK_EVENT, uint32(cmd.Process.Pid))

	// 留出短暂时间让进程自行退出
	time.Sleep(500 * time.Millisecond)

	// 使用 taskkill /F /T 强制杀死进程树
	// /F = 强制终止
	// /T = 终止子进程树
	kill := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid))
	return kill.Run()
}
