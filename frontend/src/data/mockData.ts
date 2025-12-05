import type { Chat, Message } from '../types';
import { CURRENT_USER_ID, MessageType } from '../types';

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

export const mockChats: Chat[] = [
  {
    id: '1',
    name: 'Jarvis',
    avatar: 'J',
    lastMessage: 'Отчет 17.11.2025 Grow Up: Нет задач Change: Нет задач Run: ✔ ... Восстановить LinkedIn Control: ✔ Запушить Бизнес-Мост Personal: ✔ ...',
    unreadCount: 0,
    lastMessageTime: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 37 * 60 * 1000), // 08:37
  },
  {
    id: '2',
    name: 'Нигматуллин Динар',
    avatar: 'НД',
    lastMessage: 'Ну уже заебись)',
    unreadCount: 1,
    lastMessageTime: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 31 * 60 * 1000), // 09:31
  },
  {
    id: '3',
    name: 'Наталья Массаж Лица',
    avatar: 'НМ',
    lastMessage: 'Ок, приходите )',
    unreadCount: 0,
    lastMessageTime: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 25 * 60 * 1000), // 09:25
  },
  {
    id: '4',
    name: 'Даниил Толмачев',
    avatar: 'ДТ',
    lastMessage: 'Google запустили поиск дешевых авиабилетов по всему миру: сервис Flight Deals в режиме реального времени работает как ИИ-турагент. Поддерживаются более 2...',
    unreadCount: 0,
    lastMessageTime: yesterday,
  },
  {
    id: '5',
    name: 'Victor Svetailo',
    avatar: 'VS',
    lastMessage: 'Жень, я завтра к сожалению с 12:00 буду на работе. Так что если что после можно будет обсудить моменты. Там еще нюанс, ссылка на страницу "Требования" нахо...',
    unreadCount: 0,
    lastMessageTime: yesterday,
  },
  {
    id: '6',
    name: 'Steel Steel',
    avatar: 'SS',
    lastMessage: 'Есть деньги на карте. Перевелись',
    unreadCount: 0,
    lastMessageTime: twoDaysAgo,
  },
];

export const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1-1',
      chatId: '1',
      text: 'Отчет 17.11.2025 Grow Up: Нет задач Change: Нет задач Run: ✔ ... Восстановить LinkedIn Control: ✔ Запушить Бизнес-Мост Personal: ✔ ...',
      senderId: '1',
      timestamp: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 37 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
  ],
  '2': [
    {
      id: 'm2-1',
      chatId: '2',
      text: 'Ну уже заебись)',
      senderId: '2',
      timestamp: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 31 * 60 * 1000),
      isRead: false,
      messageType: MessageType.TEXT,
    },
  ],
  '3': [
    {
      id: 'm3-1',
      chatId: '3',
      text: 'Напишите время во сколько можно',
      senderId: '3',
      timestamp: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 58 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-2',
      chatId: '3',
      text: 'Или можно вы приедете на 40 минут, а потом я вам в подарок после 10 процедур подарю 30 минутный (как поддерживающая процедура используете когда удобно будет)',
      senderId: '3',
      timestamp: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 59 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-3',
      chatId: '3',
      text: 'Вам во сколько нужно уйти от меня? В 11.40?',
      senderId: '3',
      timestamp: new Date(today.getTime() + 8 * 60 * 60 * 1000 + 59 * 60 * 1000 + 30 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-4',
      chatId: '3',
      text: 'Тогда к 11',
      senderId: CURRENT_USER_ID,
      timestamp: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 1 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-5',
      chatId: '3',
      text: 'Буду через 5 минут. Уже никуда не тороплюсь',
      senderId: CURRENT_USER_ID,
      timestamp: new Date(today.getTime() + 10 * 60 * 60 * 1000 + 59 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-6',
      chatId: '3',
      text: 'На месте',
      senderId: '3',
      timestamp: new Date(today.getTime() + 11 * 60 * 60 * 1000 + 3 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-7',
      chatId: '3',
      text: 'Евгений доброе утро! Вы когда подойдете на этой неделе ? Завтра есть время с 12 до 14 С 16 до 18 Среда с 12 до 15:30 Пятница с 18 до 19',
      senderId: '3',
      timestamp: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000 + 27 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-8',
      chatId: '3',
      text: 'Доброе утро. Завтра в 12',
      senderId: CURRENT_USER_ID,
      timestamp: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000 + 46 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-9',
      chatId: '3',
      text: 'Наталья, добрый вечер Мы завтра с вами встречаемся?)',
      senderId: CURRENT_USER_ID,
      timestamp: new Date(twoDaysAgo.getTime() + 20 * 60 * 60 * 1000 + 28 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-10',
      chatId: '3',
      text: 'Добрый вечер ! Евгений во вторник или среда 12/13/14 Завтра не работаю',
      senderId: '3',
      timestamp: new Date(twoDaysAgo.getTime() + 20 * 60 * 60 * 1000 + 55 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-11',
      chatId: '3',
      text: 'Евгений доброе',
      senderId: '3',
      timestamp: new Date(today.getTime() + 10 * 60 * 60 * 1000 + 9 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
    {
      id: 'm3-12',
      chatId: '3',
      text: 'Ок, приходите )',
      senderId: '3',
      timestamp: new Date(today.getTime() + 9 * 60 * 60 * 1000 + 25 * 60 * 1000),
      isRead: true,
      messageType: MessageType.TEXT,
    },
  ],
  '4': [
    {
      id: 'm4-1',
      chatId: '4',
      text: 'Google запустили поиск дешевых авиабилетов по всему миру: сервис Flight Deals в режиме реального времени работает как ИИ-турагент. Поддерживаются более 2...',
      senderId: '4',
      timestamp: yesterday,
      isRead: true,
      messageType: MessageType.TEXT,
    },
  ],
  '5': [
    {
      id: 'm5-1',
      chatId: '5',
      text: 'Жень, я завтра к сожалению с 12:00 буду на работе. Так что если что после можно будет обсудить моменты. Там еще нюанс, ссылка на страницу "Требования" нахо...',
      senderId: '5',
      timestamp: yesterday,
      isRead: true,
      messageType: MessageType.TEXT,
    },
  ],
  '6': [
    {
      id: 'm6-1',
      chatId: '6',
      text: 'Есть деньги на карте. Перевелись',
      senderId: '6',
      timestamp: twoDaysAgo,
      isRead: true,
      messageType: MessageType.TEXT,
    },
  ],
};

