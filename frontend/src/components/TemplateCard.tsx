import type { Template } from '../types';

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
}

export const TemplateCard = ({ template, onUse, onEdit, onDelete }: TemplateCardProps) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(template);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(template);
  };

  return (
    <div
      onClick={() => onUse(template)}
      className="group flex-shrink-0 relative bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 hover:border-blue-500 hover:bg-gray-700 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/20"
    >
      <div className="flex items-center gap-2">
        {/* Template name */}
        <span className="text-white text-sm font-medium truncate max-w-[200px]">
          {template.name}
        </span>

        {/* File indicator if has files */}
        {template.files && template.files.length > 0 && (
          <span className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
              <path d="M14 2v6h6" />
            </svg>
            {template.files.length}
          </span>
        )}

        {/* Action buttons - show on hover */}
        <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleEdit}
            className="p-1 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-gray-700"
            title="Редактировать"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-gray-700"
            title="Удалить"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

