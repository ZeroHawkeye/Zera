/**
 * 全局搜索组件
 * 支持 Ctrl+K 快捷键搜索所有菜单项并进行路由跳转
 * 支持拼音、拼音首字母、中文搜索
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal, Input, Empty } from "antd";
import type { InputRef } from "antd";
import { Search, Command, CornerDownLeft } from "lucide-react";
import { pinyin, match } from "pinyin-pro";
import { useMenuStore } from "@/stores";
import type { MenuItem, MenuNavItem } from "@/config/menu";
import { isMenuNavItem, isMenuGroup } from "@/config/menu/types";

const ACTIVE_BG_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-primary-light)",
};
const ACTIVE_BAR_STYLE: React.CSSProperties = {
  borderLeftColor: "var(--color-primary)",
};
const ACTIVE_ICON_STYLE: React.CSSProperties = {
  color: "var(--color-primary)",
};
const ACTIVE_ICON_BG_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-primary-light)",
};
const ACTIVE_TEXT_STYLE: React.CSSProperties = {
  color: "var(--color-primary)",
};

/**
 * 扁平化后的搜索项
 */
interface SearchItem {
  /** 唯一标识 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 路由路径 */
  path: string;
  /** 面包屑路径（用于显示层级） */
  breadcrumb: string[];
  /** 图标组件 */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * 将菜单项扁平化为可搜索的列表
 */
function flattenMenuForSearch(
  items: MenuItem[],
  breadcrumb: string[] = [],
): SearchItem[] {
  const result: SearchItem[] = [];

  for (const item of items) {
    if (isMenuNavItem(item)) {
      const navItem = item as MenuNavItem;
      const currentBreadcrumb = [...breadcrumb, navItem.label];

      // 有路径的菜单项添加到搜索结果
      if (navItem.path && !navItem.hidden) {
        result.push({
          key: navItem.key,
          label: navItem.label,
          path: navItem.path,
          breadcrumb: currentBreadcrumb,
          icon: typeof navItem.icon === "function" ? navItem.icon : undefined,
        });
      }

      // 递归处理子菜单
      if (navItem.children && navItem.children.length > 0) {
        result.push(
          ...flattenMenuForSearch(navItem.children, currentBreadcrumb),
        );
      }
    } else if (isMenuGroup(item)) {
      // 分组菜单只处理子项
      const currentBreadcrumb = [...breadcrumb, item.label];
      result.push(...flattenMenuForSearch(item.children, currentBreadcrumb));
    }
  }

  return result;
}

/**
 * 搜索结果项组件
 */
function SearchResultItem({
  item,
  isActive,
  onClick,
}: {
  item: SearchItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150
        ${
          isActive
            ? "border-l-2"
            : "hover:bg-hover border-l-2 border-transparent"
        }
      `}
      style={isActive ? { ...ACTIVE_BG_STYLE, ...ACTIVE_BAR_STYLE } : undefined}
    >
      {/* 图标 */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          ${isActive ? "" : "bg-subtle text-tertiary"}
        `}
        style={
          isActive
            ? { ...ACTIVE_ICON_BG_STYLE, ...ACTIVE_ICON_STYLE }
            : undefined
        }
      >
        {Icon ? <Icon className="w-4 h-4" /> : <Search className="w-4 h-4" />}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div
          className={`font-medium ${isActive ? "" : "text-default"}`}
          style={isActive ? ACTIVE_TEXT_STYLE : undefined}
        >
          {item.label}
        </div>
        <div className="text-xs text-muted truncate">
          {item.breadcrumb.join(" / ")}
        </div>
      </div>

      {/* 回车提示 */}
      {isActive && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <CornerDownLeft className="w-3 h-3" />
          <span>进入</span>
        </div>
      )}
    </div>
  );
}

/**
 * 全局搜索弹窗组件
 */
export function GlobalSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { getMenuItems } = useMenuStore();
  const [searchValue, setSearchValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);

  // 获取所有菜单项并扁平化
  const allSearchItems = useMemo(() => {
    const menuItems = getMenuItems();
    return flattenMenuForSearch(menuItems);
  }, [getMenuItems]);

  /**
   * 检查文本是否匹配搜索词（支持拼音、首字母、中文）
   * @param text 要匹配的文本
   * @param search 搜索词（已转小写）
   * @returns 是否匹配
   */
  const matchText = useCallback((text: string, search: string): boolean => {
    const lowerText = text.toLowerCase();

    // 1. 直接匹配（中英文）
    if (lowerText.includes(search)) {
      return true;
    }

    // 2. 使用 pinyin-pro 的 match 函数进行拼音匹配
    // match 函数会自动处理全拼、首字母、混合匹配
    const matchResult = match(text, search);
    if (matchResult) {
      return true;
    }

    // 3. 获取完整拼音进行匹配
    const fullPinyin = pinyin(text, { toneType: "none", type: "array" }).join(
      "",
    );
    if (fullPinyin.includes(search)) {
      return true;
    }

    // 4. 获取拼音首字母进行匹配
    const firstLetters = pinyin(text, {
      pattern: "first",
      toneType: "none",
      type: "array",
    }).join("");
    if (firstLetters.includes(search)) {
      return true;
    }

    return false;
  }, []);

  // 根据搜索词过滤结果
  const filteredItems = useMemo(() => {
    if (!searchValue.trim()) {
      return allSearchItems;
    }

    const lowerSearch = searchValue.toLowerCase();
    return allSearchItems.filter((item) => {
      // 匹配标签（支持拼音）
      if (matchText(item.label, lowerSearch)) {
        return true;
      }
      // 匹配面包屑路径（支持拼音）
      if (item.breadcrumb.some((b) => matchText(b, lowerSearch))) {
        return true;
      }
      // 匹配路由路径（只匹配英文）
      if (item.path.toLowerCase().includes(lowerSearch)) {
        return true;
      }
      return false;
    });
  }, [allSearchItems, searchValue, matchText]);

  // 重置选中项
  useEffect(() => {
    setActiveIndex(0);
  }, [searchValue]);

  // 打开时聚焦输入框，关闭时重置状态
  useEffect(() => {
    if (open) {
      // 使用 setTimeout 确保 Modal 动画完成后再聚焦
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSearchValue("");
      setActiveIndex(0);
    }
  }, [open]);

  // 处理导航
  const handleNavigate = useCallback(
    (item: SearchItem) => {
      navigate({ to: item.path });
      onClose();
    },
    [navigate, onClose],
  );

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : filteredItems.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[activeIndex]) {
            handleNavigate(filteredItems[activeIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, activeIndex, handleNavigate, onClose],
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      centered
      className="global-search-modal"
      styles={{
        body: { padding: 0 },
        mask: { backdropFilter: "blur(4px)" },
      }}
    >
      {/* 搜索输入框 */}
      <div className="p-4 border-b border-default">
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          placeholder="搜索菜单..."
          prefix={<Search className="w-5 h-5 text-gray-400" />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="!border-0 !shadow-none !bg-transparent"
          allowClear
        />
      </div>

      {/* 搜索结果 */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredItems.length > 0 ? (
          <div className="py-2">
            {filteredItems.map((item, index) => (
              <SearchResultItem
                key={item.key}
                item={item}
                isActive={index === activeIndex}
                onClick={() => handleNavigate(item)}
              />
            ))}
          </div>
        ) : (
          <div className="py-12">
            <Empty description="未找到相关菜单" />
          </div>
        )}
      </div>

      {/* 快捷键提示 */}
      <div className="px-4 py-3 border-t border-default bg-subtle flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-container border border-default rounded text-secondary">
              ↑
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-container border border-default rounded text-secondary">
              ↓
            </kbd>
            <span className="ml-1">选择</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-container border border-default rounded text-secondary">
              ↵
            </kbd>
            <span className="ml-1">确认</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-container border border-default rounded text-secondary">
              esc
            </kbd>
            <span className="ml-1">关闭</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Command className="w-3 h-3" />
          <span>+</span>
          <kbd className="px-1.5 py-0.5 bg-container border border-default rounded text-secondary">
            K
          </kbd>
          <span className="ml-1">打开搜索</span>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 全局搜索触发按钮组件
 * 包含快捷键监听
 */
export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  // 监听全局快捷键 Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* 搜索触发按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-interactive rounded-xl transition-all duration-200 text-tertiary hover:text-default hover:shadow-sm"
      >
        <Search className="w-5 h-5" />
        <span className="hidden md:inline text-sm">搜索</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-subtle border border-default rounded text-xs text-muted">
          <Command className="w-3 h-3" />
          <span>K</span>
        </kbd>
      </button>

      {/* 搜索弹窗 */}
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default GlobalSearchTrigger;
