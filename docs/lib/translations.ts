import { BookOpen, Zap, Code2, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface HomeTranslation {
  badge: string;
  title: string;
  description: string;
  getStarted: string;
  whyZera: string;
  whyZeraDesc: string;
  quickStart: string;
  quickStartDesc: string;
  cloneProject: string;
  enterDir: string;
  startDev: string;
  viewDocs: string;
  docs: string;
  features: Feature[];
}

export const homeTranslations: Record<string, HomeTranslation> = {
  zh: {
    badge: '全栈开发框架',
    title: 'Zera Admin',
    description: '一个基于 Protocol Buffers 的现代化全栈开发框架，让前后端开发更简单、更高效、更类型安全。',
    getStarted: '开始使用',
    whyZera: '为什么选择 Zera？',
    whyZeraDesc: 'Zera 提供了完整的全栈开发解决方案，让你专注于业务逻辑而非基础设施',
    quickStart: '快速开始',
    quickStartDesc: '只需几条命令即可启动开发环境',
    cloneProject: '克隆项目',
    enterDir: '进入项目目录',
    startDev: '启动开发环境',
    viewDocs: '查看完整文档',
    docs: '文档',
    features: [
      {
        icon: Zap,
        title: '快速开发',
        description: '基于 Protocol Buffers 自动生成前后端代码，开箱即用',
      },
      {
        icon: Code2,
        title: '类型安全',
        description: 'TypeScript + Go 强类型保证，从 proto 到代码全程类型安全',
      },
      {
        icon: Layers,
        title: '现代架构',
        description: 'Connect-RPC 协议，支持 gRPC、gRPC-Web 和 Connect 多种调用方式',
      },
      {
        icon: BookOpen,
        title: '完善文档',
        description: '详细的开发指南和 API 文档，助你快速上手',
      },
    ],
  },
  en: {
    badge: 'Full-Stack Framework',
    title: 'Zera Admin',
    description: 'A modern full-stack development framework based on Protocol Buffers, making frontend and backend development simpler, more efficient, and type-safe.',
    getStarted: 'Get Started',
    whyZera: 'Why Choose Zera?',
    whyZeraDesc: 'Zera provides a complete full-stack development solution, allowing you to focus on business logic rather than infrastructure',
    quickStart: 'Quick Start',
    quickStartDesc: 'Just a few commands to start the development environment',
    cloneProject: 'Clone the project',
    enterDir: 'Enter project directory',
    startDev: 'Start development environment',
    viewDocs: 'View Full Documentation',
    docs: 'Docs',
    features: [
      {
        icon: Zap,
        title: 'Rapid Development',
        description: 'Auto-generate frontend and backend code based on Protocol Buffers, ready to use out of the box',
      },
      {
        icon: Code2,
        title: 'Type Safety',
        description: 'TypeScript + Go strong typing ensures type safety from proto to code',
      },
      {
        icon: Layers,
        title: 'Modern Architecture',
        description: 'Connect-RPC protocol, supporting gRPC, gRPC-Web, and Connect calling methods',
      },
      {
        icon: BookOpen,
        title: 'Complete Documentation',
        description: 'Detailed development guides and API documentation to help you get started quickly',
      },
    ],
  },
  ja: {
    badge: 'フルスタックフレームワーク',
    title: 'Zera Admin',
    description: 'Protocol Buffers をベースにしたモダンなフルスタック開発フレームワーク。フロントエンドとバックエンドの開発をよりシンプルに、効率的に、型安全に。',
    getStarted: '始める',
    whyZera: 'なぜ Zera を選ぶのか？',
    whyZeraDesc: 'Zera は完全なフルスタック開発ソリューションを提供し、インフラストラクチャではなくビジネスロジックに集中できます',
    quickStart: 'クイックスタート',
    quickStartDesc: '数コマンドで開発環境を起動できます',
    cloneProject: 'プロジェクトをクローン',
    enterDir: 'プロジェクトディレクトリに移動',
    startDev: '開発環境を起動',
    viewDocs: '完全なドキュメントを見る',
    docs: 'ドキュメント',
    features: [
      {
        icon: Zap,
        title: '高速開発',
        description: 'Protocol Buffers に基づいてフロントエンド・バックエンドコードを自動生成、すぐに使用可能',
      },
      {
        icon: Code2,
        title: '型安全',
        description: 'TypeScript + Go の強い型付けにより、proto からコードまで一貫した型安全性を保証',
      },
      {
        icon: Layers,
        title: 'モダンアーキテクチャ',
        description: 'Connect-RPC プロトコル、gRPC、gRPC-Web、Connect の呼び出し方式をサポート',
      },
      {
        icon: BookOpen,
        title: '充実したドキュメント',
        description: '詳細な開発ガイドと API ドキュメントで、すぐに始められます',
      },
    ],
  },
};

/**
 * 获取指定语言的首页翻译
 * @param lang 语言代码
 * @returns 翻译对象，如果语言不存在则返回中文
 */
export function getHomeTranslation(lang: string): HomeTranslation {
  return homeTranslations[lang] || homeTranslations.zh;
}
