/* eslint-disable */
// frontend/src/components/admin/content-resources/ContentResourceForm.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { apiCall } from '@/utils/adminApi';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { FiInfo, FiHelpCircle } from 'react-icons/fi';

interface EditableResource {
  id?: number;
  title: string;
  content: string;
  source: string | null;
  description?: string | null;
  type: string;
  tags?: string[];
}

interface ContentResourceFormProps {
  resource?: EditableResource;
  onSuccess: () => void;
}

const ContentResourceForm: React.FC<ContentResourceFormProps> = ({ resource, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: resource?.title ?? '',
    type: resource?.type ?? 'text',
    content: resource?.content ?? '',
    source: resource?.source ?? '',
    description: resource?.description ?? '',
    tags: resource?.tags?.join(', ') ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('type', formData.type);
      if (formData.description) payload.append('description', formData.description);
      if (formData.tags) payload.append('tags', formData.tags);

      if (formData.type === 'text') {
        if (!formData.content) {
          throw new Error('Content is required for text resources.');
        }
        payload.append('content', formData.content);
      }

      if (formData.type === 'url') {
        if (!formData.source) {
          throw new Error('A valid URL is required for URL resources.');
        }
        payload.append('source', formData.source);
      }

      if (formData.type === 'pdf') {
        if (file) {
          payload.append('file', file);
        } else if (!resource) {
          throw new Error('Please upload a PDF file.');
        }
        if (formData.source) {
          payload.append('source', formData.source);
        }
      }

      if (resource) {
        await apiCall('/api/v1/admin/content-resources/' + resource.id,
          {
            method: 'PUT',
            body: payload,
          });
      } else {
        await apiCall('/api/v1/admin/content-resources', {
          method: 'POST',
          body: payload,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      {/* Help Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <FiInfo className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-200 font-medium mb-1">How AI Uses This Content</p>
            <p className="text-xs text-blue-200/80 leading-relaxed">
              When users chat with our AI counselors, the system will search through this content to provide accurate, 
              evidence-based mental health guidance. The content is automatically processed and embedded for semantic search.
            </p>
          </div>
        </div>
      </div>

      {/* Title Field */}
      <div>
        <Input
          name="title"
          label="Title"
          value={formData.title}
          onChange={handleChange}
          required
          placeholder="e.g., Cognitive Behavioral Therapy Techniques"
          className="w-full pl-10 pr-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
        />
        <p className="mt-1.5 text-xs text-gray-400">Clear, descriptive title that helps identify the content</p>
      </div>

      {/* Type Selection */}
      <div>
        <Select
          name="type"
          label="Resource Type"
          value={formData.type}
          onChange={handleChange}
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-colors"
        >
          <option value="text" className="bg-gray-800">📝 Text - Direct content input</option>
          <option value="url" className="bg-gray-800">🌐 URL - Web page or article</option>
          <option value="pdf" className="bg-gray-800">📄 PDF - Document upload</option>
        </Select>
        <div className="mt-2 space-y-1">
          <p className="text-xs text-gray-400">Choose the format of your content:</p>
          <ul className="text-xs text-gray-500 space-y-0.5 ml-4">
            <li>• <span className="text-gray-400">Text:</span> Therapy techniques, coping strategies, guidelines</li>
            <li>• <span className="text-gray-400">URL:</span> Trusted mental health websites and articles</li>
            <li>• <span className="text-gray-400">PDF:</span> Clinical research, workbooks, manuals</li>
          </ul>
        </div>
      </div>

      {/* Description Field */}
      <div>
        <Input
          name="description"
          label="Description (Optional)"
          value={formData.description}
          onChange={handleChange}
          placeholder="Brief summary of what this resource covers"
          className="w-full pl-10 pr-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
        />
        <p className="mt-1.5 text-xs text-gray-400">Helps other admins quickly understand the resource's purpose</p>
      </div>

      {/* Tags Field */}
      <div>
        <Input
          name="tags"
          label="Tags (Optional)"
          value={formData.tags}
          onChange={handleChange}
          placeholder="anxiety, depression, coping-skills, therapy"
          className="w-full pl-10 pr-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
        />
        <p className="mt-1.5 text-xs text-gray-400">
          Comma-separated keywords for better organization. Common tags: anxiety, depression, stress, therapy, self-care, mindfulness
        </p>
      </div>

      {/* Type-Specific Fields */}
      {formData.type === 'text' && (
        <div className="space-y-2">
          <label htmlFor="content" className="block text-sm font-medium text-gray-300">
            Content *
          </label>
          <Textarea
            name="content"
            value={formData.content}
            onChange={handleChange}
            required
            placeholder="Enter your mental health content here...&#10;&#10;Example:&#10;Deep breathing is an effective technique for managing anxiety. To practice:&#10;1. Find a comfortable position&#10;2. Inhale slowly through your nose for 4 counts&#10;3. Hold for 4 counts&#10;4. Exhale through your mouth for 6 counts&#10;5. Repeat for 5 minutes"
            className="w-full min-h-[200px] p-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10 resize-y"
          />
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex gap-2">
              <FiHelpCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-green-200 font-medium mb-1">Best Practices for Text Content:</p>
                <ul className="text-xs text-green-200/80 space-y-0.5 ml-4">
                  <li>• Use clear, professional mental health language</li>
                  <li>• Include practical examples and step-by-step instructions</li>
                  <li>• Cite credible sources when referencing research</li>
                  <li>• Focus on evidence-based techniques and approaches</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {formData.type === 'url' && (
        <div className="space-y-2">
          <Input
            name="source"
            label="URL *"
            value={formData.source}
            onChange={handleChange}
            required
            placeholder="https://www.nimh.nih.gov/health/topics/anxiety-disorders"
            className="w-full pl-10 pr-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm hover:bg-white/10"
          />
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex gap-2">
              <FiHelpCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-green-200 font-medium mb-1">Recommended Sources:</p>
                <ul className="text-xs text-green-200/80 space-y-0.5 ml-4">
                  <li>• National mental health organizations (NIMH, WHO)</li>
                  <li>• Peer-reviewed research articles</li>
                  <li>• Professional counseling associations</li>
                  <li>• University mental health resources</li>
                </ul>
                <p className="text-xs text-green-200/80 mt-2">
                  The system will automatically extract and process content from the URL.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {formData.type === 'pdf' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">PDF File *</label>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-6 hover:border-[#FFCA40]/50 transition-colors">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="Upload PDF file"
              title="Upload PDF file"
              className="block w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#FFCA40] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-black hover:file:bg-[#FFD700] file:cursor-pointer cursor-pointer"
            />
            {file && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
                <FiInfo className="h-4 w-4" />
                <span>Selected: {file.name}</span>
              </div>
            )}
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="flex gap-2">
              <FiHelpCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-green-200 font-medium mb-1">Good PDF Content:</p>
                <ul className="text-xs text-green-200/80 space-y-0.5 ml-4">
                  <li>• Clinical guidelines and protocols</li>
                  <li>• Therapy workbooks and worksheets</li>
                  <li>• Research papers and studies</li>
                  <li>• Educational materials and handouts</li>
                </ul>
                <p className="text-xs text-green-200/80 mt-2">
                  Text will be extracted automatically. Ensure PDF contains selectable text (not just images).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      <Button type="submit" disabled={isLoading} className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-[#FFCA40] to-[#FFD700] text-[#001D58] font-semibold rounded-xl hover:from-[#FFD700] hover:to-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed group shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
        {isLoading ? 'Saving...' : 'Save Resource'}
      </Button>
    </form>
  );
};

export default ContentResourceForm;
