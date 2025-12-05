package cli

import (
	"fmt"
	"strings"
	"sync"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Tab 类型定义
type Tab int

const (
	TabAll Tab = iota
	TabFrontend
	TabBackend
)

// ServiceStatus 服务状态
type ServiceStatus int

const (
	StatusStopped  ServiceStatus = iota // 已停止
	StatusStarting                      // 启动中
	StatusRunning                       // 运行中
	StatusFailed                        // 启动失败
)

// 日志消息类型
type logMsg struct {
	source  Tab // TabFrontend 或 TabBackend
	content string
}

// serviceStatusMsg 服务状态变更消息
type serviceStatusMsg struct {
	service Tab           // TabFrontend 或 TabBackend
	status  ServiceStatus // 新状态
	err     error         // 错误信息（如果失败）
}

// 侧边栏宽度常量
const sidebarWidth = 18

// DevTUI 开发服务器 TUI 模型
type DevTUI struct {
	// 视口
	viewport viewport.Model

	// Tab 状态
	activeTab Tab
	tabs      []string

	// 日志缓冲区
	allLogs      []string
	frontendLogs []string
	backendLogs  []string
	maxLogLines  int
	logMutex     sync.Mutex

	// UI 状态
	width        int
	height       int
	ready        bool
	copyMode     bool // 复制模式（纯文本，无边框）
	showHelp     bool // 显示帮助
	autoScroll   bool // 自动滚动到底部
	scrollOffset int  // 当前滚动偏移

	// 服务状态
	frontendStatus ServiceStatus
	backendStatus  ServiceStatus
	frontendError  error
	backendError   error

	// 日志通道
	logChan chan logMsg

	// 服务状态通道
	statusChan chan serviceStatusMsg

	// 重启回调函数
	restartCallback func(service Tab)
}

// 样式定义
var (
	// 侧边栏样式
	sidebarStyle = lipgloss.NewStyle().
			Width(sidebarWidth).
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#444444")).
			BorderRight(true).
			BorderTop(false).
			BorderBottom(false).
			BorderLeft(false)

	// Tab 样式 - 激活状态
	activeTabStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#7D56F4")).
			Width(sidebarWidth-2).
			Padding(0, 1)

	// Tab 样式 - 非激活状态
	inactiveTabStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#888888")).
				Width(sidebarWidth-2).
				Padding(0, 1)

	// Tab 失败样式
	failedTabStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#CC0000")).
			Width(sidebarWidth-2).
			Padding(0, 1)

	// 非激活失败样式
	inactiveFailedTabStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FF0000")).
				Width(sidebarWidth-2).
				Padding(0, 1)

	// 状态栏样式
	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888"))

	// 帮助文本样式
	helpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#626262"))

	// 复制模式提示样式
	copyModeStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFCC00")).
			Bold(true)

	// 主内容区边框样式
	contentBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color("#444444"))

	// 日志前缀样式
	frontendPrefixStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#00CCCC")).
				Bold(true)

	backendPrefixStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#CCCC00")).
				Bold(true)

	// 服务状态样式
	statusRunningStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#00FF00")).
				Bold(true)

	statusFailedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FF0000")).
				Bold(true)

	statusStartingStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FFCC00")).
				Bold(true)

	statusStoppedStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#888888"))

	// 标题样式
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#7D56F4")).
			Padding(0, 1)

	// 分隔线样式
	dividerStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#444444"))
)

// NewDevTUI 创建新的 DevTUI 实例
func NewDevTUI() *DevTUI {
	return &DevTUI{
		tabs:           []string{"All", "Frontend", "Backend"},
		activeTab:      TabAll,
		maxLogLines:    10000, // 最大保留日志行数
		allLogs:        make([]string, 0, 1000),
		frontendLogs:   make([]string, 0, 1000),
		backendLogs:    make([]string, 0, 1000),
		autoScroll:     true,
		logChan:        make(chan logMsg, 100),
		statusChan:     make(chan serviceStatusMsg, 10),
		frontendStatus: StatusStopped,
		backendStatus:  StatusStopped,
	}
}

// GetLogChan 获取日志通道
func (m *DevTUI) GetLogChan() chan<- logMsg {
	return m.logChan
}

// GetStatusChan 获取状态通道
func (m *DevTUI) GetStatusChan() chan<- serviceStatusMsg {
	return m.statusChan
}

// SetRestartCallback 设置重启回调函数
func (m *DevTUI) SetRestartCallback(callback func(service Tab)) {
	m.restartCallback = callback
}

// Init 初始化
func (m *DevTUI) Init() tea.Cmd {
	return tea.Batch(
		m.waitForLogs(),
		m.waitForStatus(),
	)
}

// waitForLogs 等待日志消息
func (m *DevTUI) waitForLogs() tea.Cmd {
	return func() tea.Msg {
		return <-m.logChan
	}
}

// waitForStatus 等待状态消息
func (m *DevTUI) waitForStatus() tea.Cmd {
	return func() tea.Msg {
		return <-m.statusChan
	}
}

// Update 处理消息
func (m *DevTUI) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		return m.handleKeyPress(msg)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		// 新布局计算:
		// - 左侧侧边栏: sidebarWidth 宽度
		// - 右侧内容区: 剩余宽度
		// - 底部状态栏: 1 行

		// 内容区高度 = 总高度 - 状态栏(1) - 上下边框(2)
		contentHeight := m.height - 3
		if contentHeight < 1 {
			contentHeight = 1
		}

		// 内容区宽度 = 总宽度 - 侧边栏宽度 - 边框(2) - 间隔(1)
		contentWidth := m.width - sidebarWidth - 4
		if contentWidth < 10 {
			contentWidth = 10
		}

		if !m.ready {
			m.viewport = viewport.New(contentWidth, contentHeight)
			m.ready = true
		} else {
			m.viewport.Width = contentWidth
			m.viewport.Height = contentHeight
		}

		m.updateViewportContent()

	case logMsg:
		m.addLog(msg)
		m.updateViewportContent()

		// 如果自动滚动开启，滚动到底部
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

		// 继续监听日志
		cmds = append(cmds, m.waitForLogs())

	case serviceStatusMsg:
		m.handleServiceStatus(msg)
		m.updateViewportContent()

		// 继续监听状态
		cmds = append(cmds, m.waitForStatus())
	}

	return m, tea.Batch(cmds...)
}

// handleKeyPress 处理按键
func (m *DevTUI) handleKeyPress(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg.String() {
	// 退出
	case "q", "ctrl+c":
		return m, tea.Quit

	// Tab 切换 - 改为上下切换
	case "tab", "j", "down":
		if m.activeTab < TabBackend {
			m.activeTab++
		} else {
			m.activeTab = TabAll
		}
		m.updateViewportContent()
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	case "shift+tab", "k", "up":
		if m.activeTab > TabAll {
			m.activeTab--
		} else {
			m.activeTab = TabBackend
		}
		m.updateViewportContent()
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	case "1":
		m.activeTab = TabAll
		m.updateViewportContent()
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	case "2":
		m.activeTab = TabFrontend
		m.updateViewportContent()
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	case "3":
		m.activeTab = TabBackend
		m.updateViewportContent()
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	// 内容滚动 - 使用 Ctrl 组合键
	case "ctrl+j":
		m.viewport.LineDown(1)
		m.autoScroll = false

	case "ctrl+k":
		m.viewport.LineUp(1)
		m.autoScroll = false

	case "d", "ctrl+d":
		m.viewport.HalfViewDown()
		m.autoScroll = false

	case "u", "ctrl+u":
		m.viewport.HalfViewUp()
		m.autoScroll = false

	case "g", "home":
		m.viewport.GotoTop()
		m.autoScroll = false

	case "G", "end":
		m.viewport.GotoBottom()
		m.autoScroll = true

	case "pagedown":
		m.viewport.ViewDown()
		m.autoScroll = false

	case "pageup":
		m.viewport.ViewUp()
		m.autoScroll = false

	// 功能键
	case "c":
		m.copyMode = !m.copyMode

	case "?":
		m.showHelp = !m.showHelp

	case "a":
		m.autoScroll = !m.autoScroll
		if m.autoScroll {
			m.viewport.GotoBottom()
		}

	case "C":
		// 清空当前 Tab 日志
		m.clearCurrentLogs()
		m.updateViewportContent()

	case "r":
		// 重启当前 Tab 对应的服务
		return m.handleRestart()
	}

	m.viewport, cmd = m.viewport.Update(msg)
	return m, cmd
}

// handleRestart 处理重启请求
func (m *DevTUI) handleRestart() (tea.Model, tea.Cmd) {
	var serviceName string
	switch m.activeTab {
	case TabAll:
		serviceName = "所有服务"
	case TabFrontend:
		serviceName = "前端服务"
	case TabBackend:
		serviceName = "后端服务"
	}

	// 发送重启日志
	m.SendLog(m.activeTab, fmt.Sprintf("🔄 正在重启%s...", serviceName))

	// 触发重启
	if m.restartCallback != nil {
		go m.restartCallback(m.activeTab)
	}

	return m, nil
}

// handleServiceStatus 处理服务状态变更
func (m *DevTUI) handleServiceStatus(msg serviceStatusMsg) {
	switch msg.service {
	case TabFrontend:
		m.frontendStatus = msg.status
		m.frontendError = msg.err
	case TabBackend:
		m.backendStatus = msg.status
		m.backendError = msg.err
	}

	// 发送状态变更日志
	var statusText string
	switch msg.status {
	case StatusStarting:
		statusText = "⏳ 启动中..."
	case StatusRunning:
		statusText = "✅ 已启动"
	case StatusFailed:
		if msg.err != nil {
			statusText = fmt.Sprintf("❌ 启动失败: %v", msg.err)
		} else {
			statusText = "❌ 异常退出"
		}
	case StatusStopped:
		statusText = "⏹️ 已停止"
	}

	m.SendLog(msg.service, statusText)
}

// addLog 添加日志
func (m *DevTUI) addLog(log logMsg) {
	m.logMutex.Lock()
	defer m.logMutex.Unlock()

	// 处理多行日志
	lines := strings.Split(strings.TrimRight(log.content, "\n"), "\n")

	for _, line := range lines {
		if line == "" {
			continue
		}

		// 根据来源添加前缀和颜色
		var formattedLine string
		if m.copyMode {
			// 复制模式下使用简单前缀
			switch log.source {
			case TabFrontend:
				formattedLine = "[frontend] " + line
			case TabBackend:
				formattedLine = "[backend]  " + line
			default:
				formattedLine = line
			}
		} else {
			// 正常模式使用彩色前缀
			switch log.source {
			case TabFrontend:
				formattedLine = frontendPrefixStyle.Render("[frontend]") + " " + line
			case TabBackend:
				formattedLine = backendPrefixStyle.Render("[backend] ") + " " + line
			default:
				formattedLine = line
			}
		}

		// 添加到对应日志列表
		m.allLogs = append(m.allLogs, formattedLine)
		switch log.source {
		case TabFrontend:
			m.frontendLogs = append(m.frontendLogs, formattedLine)
		case TabBackend:
			m.backendLogs = append(m.backendLogs, formattedLine)
		}

		// 限制日志行数
		if len(m.allLogs) > m.maxLogLines {
			m.allLogs = m.allLogs[len(m.allLogs)-m.maxLogLines:]
		}
		if len(m.frontendLogs) > m.maxLogLines {
			m.frontendLogs = m.frontendLogs[len(m.frontendLogs)-m.maxLogLines:]
		}
		if len(m.backendLogs) > m.maxLogLines {
			m.backendLogs = m.backendLogs[len(m.backendLogs)-m.maxLogLines:]
		}
	}
}

// clearCurrentLogs 清空当前 Tab 日志
func (m *DevTUI) clearCurrentLogs() {
	m.logMutex.Lock()
	defer m.logMutex.Unlock()

	switch m.activeTab {
	case TabAll:
		m.allLogs = make([]string, 0, 1000)
	case TabFrontend:
		m.frontendLogs = make([]string, 0, 1000)
	case TabBackend:
		m.backendLogs = make([]string, 0, 1000)
	}
}

// updateViewportContent 更新视口内容
func (m *DevTUI) updateViewportContent() {
	m.logMutex.Lock()
	defer m.logMutex.Unlock()

	var logs []string
	switch m.activeTab {
	case TabAll:
		logs = m.allLogs
	case TabFrontend:
		logs = m.frontendLogs
	case TabBackend:
		logs = m.backendLogs
	}

	content := strings.Join(logs, "\n")
	m.viewport.SetContent(content)
}

// View 渲染视图
func (m *DevTUI) View() string {
	if !m.ready {
		return "初始化中..."
	}

	// 复制模式：纯文本输出，无边框
	if m.copyMode {
		return m.viewCopyMode()
	}

	// 正常 TUI 模式
	return m.viewNormalMode()
}

// viewCopyMode 复制模式视图（纯文本，无边框）
func (m *DevTUI) viewCopyMode() string {
	var lines []string

	// 简单标题
	lines = append(lines, copyModeStyle.Render("📋 复制模式 - 按 'c' 返回 TUI 模式"))
	lines = append(lines, strings.Repeat("-", m.width))

	// 当前 Tab 名称
	lines = append(lines, fmt.Sprintf("当前: %s", m.tabs[m.activeTab]))
	lines = append(lines, strings.Repeat("-", m.width))

	// 日志内容（纯文本）
	m.logMutex.Lock()
	var logs []string
	switch m.activeTab {
	case TabAll:
		logs = m.allLogs
	case TabFrontend:
		logs = m.frontendLogs
	case TabBackend:
		logs = m.backendLogs
	}
	m.logMutex.Unlock()

	// 显示最后 N 行（根据窗口高度）
	visibleLines := m.height - 6
	if visibleLines < 10 {
		visibleLines = 10
	}

	startIdx := 0
	if len(logs) > visibleLines {
		startIdx = len(logs) - visibleLines
	}

	for i := startIdx; i < len(logs); i++ {
		// 移除 ANSI 颜色代码，保留纯文本
		line := stripAnsi(logs[i])
		lines = append(lines, line)
	}

	// 填充空行确保高度一致
	for len(lines) < m.height-2 {
		lines = append(lines, "")
	}

	// 底部提示
	lines = append(lines, strings.Repeat("-", m.width))
	lines = append(lines, "按 'c' 返回 TUI | 'q' 退出 | 1-3 切换")

	// 确保输出固定行数
	output := strings.Join(lines[:m.height], "\n")
	return output
}

// viewNormalMode 正常 TUI 模式视图
func (m *DevTUI) viewNormalMode() string {
	// 计算各部分高度
	contentHeight := m.height - 1 // 减去状态栏

	// 渲染左侧边栏
	sidebar := m.renderSidebar(contentHeight)

	// 渲染右侧内容区
	content := m.renderContent(contentHeight)

	// 水平拼接侧边栏和内容区
	mainArea := lipgloss.JoinHorizontal(lipgloss.Top, sidebar, content)

	// 渲染状态栏
	statusBar := m.renderStatusBar()

	// 垂直拼接主区域和状态栏
	fullView := lipgloss.JoinVertical(lipgloss.Left, mainArea, statusBar)

	// 确保输出固定大小，填充或截断
	return m.ensureFixedSize(fullView)
}

// ensureFixedSize 确保输出固定大小
func (m *DevTUI) ensureFixedSize(content string) string {
	lines := strings.Split(content, "\n")

	// 截断或填充到固定行数
	result := make([]string, m.height)
	for i := 0; i < m.height; i++ {
		if i < len(lines) {
			// 截断过长的行
			line := lines[i]
			lineWidth := lipgloss.Width(line)
			if lineWidth > m.width {
				// 简单截断（不完美但避免问题）
				result[i] = truncateString(line, m.width)
			} else if lineWidth < m.width {
				// 填充空格到固定宽度
				result[i] = line + strings.Repeat(" ", m.width-lineWidth)
			} else {
				result[i] = line
			}
		} else {
			// 空行填充
			result[i] = strings.Repeat(" ", m.width)
		}
	}

	return strings.Join(result, "\n")
}

// truncateString 截断字符串到指定宽度
func truncateString(s string, maxWidth int) string {
	if lipgloss.Width(s) <= maxWidth {
		return s
	}

	// 简单按字节截断（对于包含 ANSI 的字符串可能不完美）
	runes := []rune(s)
	result := ""
	width := 0
	for _, r := range runes {
		charWidth := 1
		if r > 127 {
			charWidth = 2 // 中文字符
		}
		if width+charWidth > maxWidth-3 {
			result += "..."
			break
		}
		result += string(r)
		width += charWidth
	}
	return result
}

// renderSidebar 渲染左侧边栏
func (m *DevTUI) renderSidebar(height int) string {
	var lines []string

	// 标题
	lines = append(lines, titleStyle.Render("⚡ Zera Dev"))
	lines = append(lines, dividerStyle.Render(strings.Repeat("─", sidebarWidth-2)))

	// Tab 列表
	for i, tab := range m.tabs {
		var style lipgloss.Style
		var tabStatus ServiceStatus

		// 获取对应 Tab 的服务状态
		switch Tab(i) {
		case TabAll:
			// All Tab 显示综合状态
			if m.frontendStatus == StatusFailed || m.backendStatus == StatusFailed {
				tabStatus = StatusFailed
			} else if m.frontendStatus == StatusRunning && m.backendStatus == StatusRunning {
				tabStatus = StatusRunning
			} else if m.frontendStatus == StatusStarting || m.backendStatus == StatusStarting {
				tabStatus = StatusStarting
			} else {
				tabStatus = StatusStopped
			}
		case TabFrontend:
			tabStatus = m.frontendStatus
		case TabBackend:
			tabStatus = m.backendStatus
		}

		// 选择样式
		if Tab(i) == m.activeTab {
			if tabStatus == StatusFailed {
				style = failedTabStyle
			} else {
				style = activeTabStyle
			}
		} else {
			if tabStatus == StatusFailed {
				style = inactiveFailedTabStyle
			} else {
				style = inactiveTabStyle
			}
		}

		// 添加快捷键提示和状态指示符
		statusIcon := m.getStatusIcon(tabStatus)
		tabText := fmt.Sprintf("%d:%s %s", i+1, tab, statusIcon)
		lines = append(lines, style.Render(tabText))
	}

	// 分隔线
	lines = append(lines, "")
	lines = append(lines, dividerStyle.Render(strings.Repeat("─", sidebarWidth-2)))

	// Runner 状态
	lines = append(lines, m.renderRunnerStatusCompact())

	// 自动滚动状态
	if m.autoScroll {
		lines = append(lines, statusStyle.Render("📜 Auto-scroll"))
	} else {
		lines = append(lines, statusStyle.Render("📜 Manual"))
	}

	// 填充空行
	for len(lines) < height {
		lines = append(lines, "")
	}

	// 截断到高度
	if len(lines) > height {
		lines = lines[:height]
	}

	// 拼接并设置宽度
	content := strings.Join(lines, "\n")
	return lipgloss.NewStyle().
		Width(sidebarWidth).
		Height(height).
		Render(content)
}

// renderContent 渲染右侧内容区
func (m *DevTUI) renderContent(height int) string {
	// 视口内容
	viewportContent := m.viewport.View()

	// 内容区宽度
	contentWidth := m.width - sidebarWidth - 1
	if contentWidth < 10 {
		contentWidth = 10
	}

	// 用边框包裹
	bordered := contentBorderStyle.
		Width(contentWidth - 2).
		Height(height - 2).
		Render(viewportContent)

	return bordered
}

// getStatusIcon 获取状态图标
func (m *DevTUI) getStatusIcon(status ServiceStatus) string {
	switch status {
	case StatusRunning:
		return "●"
	case StatusStarting:
		return "◐"
	case StatusFailed:
		return "✗"
	case StatusStopped:
		return "○"
	default:
		return "○"
	}
}

// renderRunnerStatusCompact 渲染紧凑版 Runner 状态
func (m *DevTUI) renderRunnerStatusCompact() string {
	// 检查是否有服务失败
	if m.frontendStatus == StatusFailed || m.backendStatus == StatusFailed {
		return statusFailedStyle.Render("⚠️ 异常")
	}

	// 检查是否有服务启动中
	if m.frontendStatus == StatusStarting || m.backendStatus == StatusStarting {
		return statusStartingStyle.Render("⏳ 启动中")
	}

	// 检查是否全部运行中
	if m.frontendStatus == StatusRunning && m.backendStatus == StatusRunning {
		return statusRunningStyle.Render("🚀 运行中")
	}

	// 只有前端运行
	if m.frontendStatus == StatusRunning {
		return statusRunningStyle.Render("🚀 F运行")
	}

	// 只有后端运行
	if m.backendStatus == StatusRunning {
		return statusRunningStyle.Render("🚀 B运行")
	}

	return statusStoppedStyle.Render("⏹️ 已停止")
}

// renderStatusBar 渲染状态栏
func (m *DevTUI) renderStatusBar() string {
	// 获取当前日志行数
	var logCount int
	m.logMutex.Lock()
	switch m.activeTab {
	case TabAll:
		logCount = len(m.allLogs)
	case TabFrontend:
		logCount = len(m.frontendLogs)
	case TabBackend:
		logCount = len(m.backendLogs)
	}
	m.logMutex.Unlock()

	// 滚动位置信息
	scrollInfo := fmt.Sprintf("行 %d/%d (%.0f%%)",
		m.viewport.YOffset+1,
		max(1, logCount),
		m.viewport.ScrollPercent()*100,
	)

	// 帮助提示
	var helpText string
	if m.showHelp {
		helpText = "j/k:切换Tab | Ctrl+j/k:滚动 | d/u:半页 | g/G:顶/底 | r:重启 | c:复制 | C:清空 | q:退出"
	} else {
		helpText = "? 帮助 | j/k 切换 | r 重启 | q 退出"
	}

	leftStatus := statusStyle.Render(scrollInfo)
	rightStatus := helpStyle.Render(helpText)

	gap := m.width - lipgloss.Width(leftStatus) - lipgloss.Width(rightStatus)
	if gap < 0 {
		gap = 0
	}

	return leftStatus + strings.Repeat(" ", gap) + rightStatus
}

// stripAnsi 移除 ANSI 转义序列
func stripAnsi(str string) string {
	var result strings.Builder
	inEscape := false

	for i := 0; i < len(str); i++ {
		if str[i] == '\033' {
			inEscape = true
			continue
		}
		if inEscape {
			if str[i] == 'm' {
				inEscape = false
			}
			continue
		}
		result.WriteByte(str[i])
	}

	return result.String()
}

// SendLog 发送日志到 TUI（供外部调用）
func (m *DevTUI) SendLog(source Tab, content string) {
	select {
	case m.logChan <- logMsg{source: source, content: content}:
	default:
		// 通道满了，丢弃日志（防止阻塞）
	}
}

// SendStatus 发送服务状态到 TUI（供外部调用）
func (m *DevTUI) SendStatus(service Tab, status ServiceStatus, err error) {
	select {
	case m.statusChan <- serviceStatusMsg{service: service, status: status, err: err}:
	default:
		// 通道满了，丢弃状态（防止阻塞）
	}
}

// max 返回两个整数中的较大值
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
