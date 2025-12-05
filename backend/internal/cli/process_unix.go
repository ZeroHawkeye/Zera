//go:build !windows

package cli

import (
	"os/exec"
	"syscall"
)

// setProcAttr 设置进程属性（Unix 版本）
// 创建新的进程组，以便可以通过进程组杀死所有子进程
func setProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		// 创建新的进程组
		Setpgid: true,
	}
}

// killProcessGroup 杀死进程组（Unix 版本）
// 向整个进程组发送 SIGKILL 信号
func killProcessGroup(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}

	// 获取进程组 ID（通常等于进程 ID）
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		// 如果获取失败，直接杀死进程
		return cmd.Process.Kill()
	}

	// 向整个进程组发送 SIGKILL
	// 负号表示发送给进程组
	return syscall.Kill(-pgid, syscall.SIGKILL)
}
