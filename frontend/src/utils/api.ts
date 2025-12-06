import axios from "axios";
import type {
  Bot,
  Message,
  MessageType,
  BotStatistics,
  Template,
  Tag,
  Chat,
  BotWorkflow,
  Broadcast,
  BroadcastStatistics,
} from "../types";

const MODE = import.meta.env.VITE_APP_MODE || "dev";
const API_BASE_URL =
  MODE === "live"
    ? import.meta.env.VITE_API_URL_LIVE || "api.telegram-panel.xyz"
    : "/api";

    console.log(MODE, API_BASE_URL);
    

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Для FormData не устанавливаем Content-Type - браузер установит его автоматически с boundary
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Токен истек или невалидный - автоматический редирект на страницу входа
      localStorage.removeItem("accessToken");
      localStorage.removeItem("admin");
      // Используем replace вместо href для более чистого редиректа (без добавления в историю)
      window.location.replace("/login");
    }
    return Promise.reject(error);
  }
);

// API методы для отправки медиа-сообщений
export const sendMessageWithMedia = async (
  chatId: string,
  text?: string,
  file?: File,
  messageType?: MessageType,
  caption?: string,
  replyToMessageId?: string
) => {
  const formData = new FormData();

  if (text) {
    formData.append("text", text);
  }

  if (file) {
    formData.append("file", file);
  }

  if (messageType) {
    formData.append("messageType", messageType);
  }

  if (caption) {
    formData.append("caption", caption);
  }

  if (replyToMessageId) {
    formData.append("replyToMessageId", replyToMessageId);
  }

  const response = await api.post(`/chats/${chatId}/messages`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

// API методы для работы с ботами
export const getBots = async (): Promise<Bot[]> => {
  const response = await api.get("/bots");
  return response.data;
};

export const createBot = async (token: string): Promise<Bot> => {
  const response = await api.post("/bots", { token });
  return response.data;
};

export const deleteBot = async (botId: string): Promise<void> => {
  await api.delete(`/bots/${botId}`);
};

export const toggleBotStatus = async (botId: string): Promise<Bot> => {
  const response = await api.post(`/bots/${botId}/toggle-status`);
  return response.data;
};

export const getBotStatistics = async (
  botId: string
): Promise<BotStatistics> => {
  const response = await api.get(`/bots/${botId}/statistics`);
  return response.data;
};

// Отметить чат как прочитанный
export const markChatAsRead = async (chatId: string): Promise<void> => {
  await api.post(`/chats/${chatId}/mark-as-read`);
};

// Удалить сообщение
export const deleteMessage = async (messageId: string): Promise<void> => {
  await api.post(`/chats/messages/${messageId}/delete`);
};

// Очистить историю чата
export const clearChatHistory = async (chatId: string): Promise<void> => {
  await api.post(`/chats/${chatId}/clear-history`);
};

// API методы для работы с шаблонами
export const getTemplates = async (): Promise<Template[]> => {
  const response = await api.get("/templates");
  return response.data;
};

export const createTemplate = async (
  name: string,
  text: string | null,
  files?: File[]
): Promise<Template> => {
  const formData = new FormData();
  formData.append("name", name);

  // Always append text, even if empty
  formData.append("text", text || "");

  if (files && files.length > 0) {
    files.forEach((file) => {
      formData.append("files", file);
    });
  }

  const response = await api.post("/templates", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const updateTemplate = async (
  id: string,
  name?: string,
  text?: string | null,
  files?: File[]
): Promise<Template> => {
  const formData = new FormData();

  if (name !== undefined) {
    formData.append("name", name);
  }

  if (text !== undefined) {
    formData.append("text", text || "");
  }

  if (files && files.length > 0) {
    files.forEach((file) => {
      formData.append("files", file);
    });
  }

  const response = await api.patch(`/templates/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await api.delete(`/templates/${id}`);
};

export const deleteTemplateFile = async (
  templateId: string,
  fileId: string
): Promise<void> => {
  await api.delete(`/templates/${templateId}/files/${fileId}`);
};

export const getTemplateFileUrl = (
  templateId: string,
  fileId: string
): string => {
  return `${API_BASE_URL}/templates/${templateId}/files/${fileId}`;
};

// Reactions API
export const addReaction = async (
  messageId: string,
  emoji: string
): Promise<Message> => {
  const response = await api.post(`/chats/messages/${messageId}/reactions`, {
    emoji,
  });
  return response.data;
};

export const removeReaction = async (
  messageId: string,
  reactionId: string
): Promise<Message> => {
  const response = await api.delete(
    `/chats/messages/${messageId}/reactions/${reactionId}`
  );
  return response.data;
};

// Tags API
export const getAllTags = async (): Promise<Tag[]> => {
  const response = await api.get("/chats/tags-list");
  return response.data;
};

export const addTagToChat = async (
  chatId: string,
  tagId: string
): Promise<Chat> => {
  const response = await api.post(`/chats/${chatId}/tags/${tagId}`);
  return response.data;
};

export const removeTagFromChat = async (
  chatId: string,
  tagId: string
): Promise<Chat> => {
  const response = await api.delete(`/chats/${chatId}/tags/${tagId}`);
  return response.data;
};

// Универсальные сценарии (без привязки к боту)
export const getWorkflows = async (): Promise<BotWorkflow[]> => {
  const response = await api.get("/workflows");
  return response.data;
};

export const getWorkflowById = async (id: string): Promise<BotWorkflow> => {
  const response = await api.get(`/workflows/${id}`);
  return response.data;
};

export const createWorkflow = async (
  workflow: Partial<BotWorkflow & { botIds?: string[] }>
): Promise<BotWorkflow> => {
  const response = await api.post("/workflows", workflow);
  return response.data;
};

export const updateWorkflow = async (
  workflowId: string,
  workflow: Partial<BotWorkflow & { botIds?: string[] }>
): Promise<BotWorkflow> => {
  const response = await api.put(`/workflows/${workflowId}`, workflow);
  return response.data;
};

export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  await api.delete(`/workflows/${workflowId}`);
};

export const activateWorkflow = async (
  workflowId: string
): Promise<BotWorkflow> => {
  const response = await api.post(`/workflows/${workflowId}/activate`);
  return response.data;
};

export const deactivateWorkflow = async (
  workflowId: string
): Promise<BotWorkflow> => {
  const response = await api.post(`/workflows/${workflowId}/deactivate`);
  return response.data;
};

// Старые методы для обратной совместимости (привязаны к боту)
export const getBotWorkflows = async (
  botId: string
): Promise<BotWorkflow[]> => {
  const response = await api.get(`/bots/${botId}/workflows`);
  return response.data;
};

export const uploadWorkflowFile = async (
  botId: string,
  file: File
): Promise<{ fileId: string; fileType: string; fileUrl?: string | null }> => {
  console.log("[API] uploadWorkflowFile called:", {
    botId,
    fileName: file.name,
    fileSize: file.size,
  });

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.post(
      `/bots/${botId}/workflows/files/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    console.log("[API] uploadWorkflowFile success:", response.data);
    return response.data;
  } catch (error) {
    console.error("[API] uploadWorkflowFile error:", error);
    throw error;
  }
};

export const getWorkflowFileUrl = async (
  botId: string,
  fileId: string
): Promise<string | null> => {
  const response = await api.get(
    `/bots/${botId}/workflows/files/${fileId}/url`
  );
  return response.data.fileUrl ?? null;
};

// Broadcasts API
export const createBroadcast = async (
  formData: FormData
): Promise<Broadcast> => {
  // Axios автоматически установит правильный Content-Type для FormData
  const response = await api.post("/broadcasts", formData);
  return response.data;
};

export const getBroadcasts = async (): Promise<Broadcast[]> => {
  const response = await api.get("/broadcasts");
  return response.data;
};

export const getBroadcastById = async (id: string): Promise<Broadcast> => {
  const response = await api.get(`/broadcasts/${id}`);
  return response.data;
};

export const getBroadcastStatistics = async (
  id: string
): Promise<BroadcastStatistics> => {
  const response = await api.get(`/broadcasts/${id}/statistics`);
  return response.data;
};

export const sendBroadcast = async (id: string): Promise<void> => {
  await api.post(`/broadcasts/${id}/send`);
};

export const copyBroadcast = async (id: string): Promise<Broadcast> => {
  const response = await api.post(`/broadcasts/${id}/copy`);
  return response.data;
};

export const deleteBroadcast = async (id: string): Promise<void> => {
  await api.delete(`/broadcasts/${id}`);
};

// Upload file to server (for universal workflows)
export const uploadFileToServer = async (
  file: File
): Promise<{
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/uploads", formData);
  return response.data;
};
