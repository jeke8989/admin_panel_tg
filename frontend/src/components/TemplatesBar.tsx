import { useEffect, useState } from 'react';
import type { Template } from '../types';
import { TemplateCard } from './TemplateCard';
import { CreateTemplateModal } from './CreateTemplateModal';
import { EditTemplateModal } from './EditTemplateModal';
import { DeleteTemplateModal } from './DeleteTemplateModal';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../utils/api';

interface TemplatesBarProps {
  onTemplateSelect: (template: Template) => void;
}

export const TemplatesBar = ({ onTemplateSelect }: TemplatesBarProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleCreate = async (name: string, text: string | null, files: File[]) => {
    try {
      setIsLoading(true);
      await createTemplate(name, text, files);
      await loadTemplates();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Error creating template:', error);
      const errorMessage = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 
                           (error as { message?: string })?.message || 
                           'Ошибка при создании шаблона';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (id: string, name?: string, text?: string | null, files?: File[]) => {
    try {
      setIsLoading(true);
      await updateTemplate(id, name, text, files);
      await loadTemplates();
      setIsEditModalOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
      const errorMessage = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 
                           (error as { message?: string })?.message || 
                           'Ошибка при обновлении шаблона';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    
    try {
      setIsLoading(true);
      await deleteTemplate(selectedTemplate.id);
      await loadTemplates();
      setIsDeleteModalOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      const errorMessage = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || 
                           (error as { message?: string })?.message || 
                           'Ошибка при удалении шаблона';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseTemplate = (template: Template) => {
    onTemplateSelect(template);
  };

  const handleEditClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsDeleteModalOpen(true);
  };

  return (
    <>
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
            title="Создать шаблон"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3">
              {templates.length === 0 ? (
                <p className="text-gray-500 text-sm py-2">Нет шаблонов. Создайте первый!</p>
              ) : (
                templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={handleUseTemplate}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreate}
        isLoading={isLoading}
      />

      <EditTemplateModal
        isOpen={isEditModalOpen}
        template={selectedTemplate}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTemplate(null);
        }}
        onConfirm={handleEdit}
        isLoading={isLoading}
      />

      <DeleteTemplateModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedTemplate(null);
        }}
        onConfirm={handleDelete}
        isLoading={isLoading}
        templateName={selectedTemplate?.name || ''}
      />
    </>
  );
};

