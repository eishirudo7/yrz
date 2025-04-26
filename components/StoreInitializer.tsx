'use client'
import { useStoreChatInitializer, useStoreChatIntegration } from '@/stores/useStoreChat';
 
export default function StoreInitializer() {
  useStoreChatInitializer();
  useStoreChatIntegration();
  return null;
} 