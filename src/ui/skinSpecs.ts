import type { SkinId } from "../domain/types";
import {
  Boxes,
  CircleUserRound,
  Code2,
  Folder,
  Library,
  MoreHorizontal,
  PanelsTopLeft,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  label: string;
  icon: typeof PenLine;
};

export type SkinSpec = {
  id: SkinId;
  brand: string;
  subBrand?: string;
  recentLabel: string;
  inputPlaceholder: string;
  navItems: NavItem[];
};

const chatNav: NavItem[] = [
  { label: "新聊天", icon: PenLine },
  { label: "搜索聊天", icon: Search },
  { label: "库", icon: Library },
  { label: "项目", icon: Folder },
  { label: "应用", icon: Boxes },
  { label: "Codex", icon: CircleUserRound },
  { label: "更多", icon: MoreHorizontal },
];

export const skinSpecs: Record<SkinId, SkinSpec> = {
  chatgpt: {
    id: "chatgpt",
    brand: "ChatGPT",
    subBrand: "Pro",
    recentLabel: "最近",
    inputPlaceholder: "输入内容...",
    navItems: chatNav,
  },
  gemini: {
    id: "gemini",
    brand: "Gemini",
    recentLabel: "Recents",
    inputPlaceholder: "Ask Gemini",
    navItems: [
      { label: "New chat", icon: PenLine },
      { label: "Search chats", icon: Search },
      { label: "Library", icon: Boxes },
    ],
  },
  deepseek: {
    id: "deepseek",
    brand: "deepseek",
    recentLabel: "2026-04",
    inputPlaceholder: "给 DeepSeek 发送消息",
    navItems: [
      { label: "开启新对话", icon: Sparkles },
      { label: "搜索", icon: Search },
      { label: "收起边栏", icon: PanelsTopLeft },
    ],
  },
  doubao: {
    id: "doubao",
    brand: "豆包",
    recentLabel: "历史对话",
    inputPlaceholder: "发消息...",
    navItems: [
      { label: "新对话", icon: PenLine },
      { label: "AI 创作", icon: Sparkles },
      { label: "更多", icon: MoreHorizontal },
    ],
  },
};
