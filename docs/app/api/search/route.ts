import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer as createMandarinTokenizer } from '@orama/tokenizers/mandarin';
import { createTokenizer as createJapaneseTokenizer } from '@orama/tokenizers/japanese';

// CJK (中日韩) 语言需要特殊的分词器
// 使用 @orama/tokenizers 提供的实验性分词器
// 如需支持更多语言，可以：
// 1. 使用 @orama/tokenizers 提供的分词器（mandarin, japanese, korean）
// 2. 对于 Orama 内置支持的语言，直接设置 language 属性
// 3. 对于其他语言，可以自定义分词器或使用通用分词策略

export const { GET } = createFromSource(source, {
  localeMap: {
    // 中文使用 Mandarin tokenizer
    zh: {
      components: {
        tokenizer: createMandarinTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },
    // 日语使用 Japanese tokenizer
    ja: {
      components: {
        tokenizer: createJapaneseTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },
    // 英文使用 Orama 内置支持
    en: {
      language: 'english',
    },
    // 如需添加更多语言，参考以下示例：
    // de: { language: 'german' },
    // fr: { language: 'french' },
    // es: { language: 'spanish' },
    // 完整的内置语言列表见 Orama 文档
  },
});
