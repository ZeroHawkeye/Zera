import Link from 'next/link';
import { BookOpen, Zap, Code2, Layers, ArrowRight, Github } from 'lucide-react';

// 多语言文本配置
const translations = {
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
};

const techStack = [
  { name: 'Go', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { name: 'React', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { name: 'TypeScript', color: 'bg-blue-600/10 text-blue-700 dark:text-blue-300' },
  { name: 'Protocol Buffers', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { name: 'Connect-RPC', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { name: 'Vite', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = translations[lang as keyof typeof translations] || translations.zh;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              {t.badge}
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {t.title}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
              {t.description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/${lang}/docs`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {t.getStarted}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/ZeroHawkeye/Zera"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border bg-background font-medium hover:bg-accent transition-colors"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-y border-border bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {techStack.map((tech) => (
              <span
                key={tech.name}
                className={`px-4 py-2 rounded-full text-sm font-medium ${tech.color}`}
              >
                {tech.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.whyZera}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.whyZeraDesc}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {t.features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.quickStart}</h2>
            <p className="text-muted-foreground text-lg">{t.quickStartDesc}</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm text-muted-foreground">Terminal</span>
              </div>
              <div className="p-6 font-mono text-sm">
                <div className="text-muted-foreground"># {t.cloneProject}</div>
                <div className="text-foreground mb-3">$ git clone https://github.com/ZeroHawkeye/Zera.git</div>
                
                <div className="text-muted-foreground"># {t.enterDir}</div>
                <div className="text-foreground mb-3">$ cd zera</div>
                
                <div className="text-muted-foreground"># {t.startDev}</div>
                <div className="text-foreground">$ task dev</div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Link
              href={`/${lang}/docs`}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              {t.viewDocs}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2025 Zera Framework. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href={`/${lang}/docs`} className="hover:text-foreground transition-colors">
                {t.docs}
              </Link>
              <a
                href="https://github.com/ZeroHawkeye/Zera"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
