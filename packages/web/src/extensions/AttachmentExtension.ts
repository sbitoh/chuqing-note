import { Node, mergeAttributes } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import AttachmentCard from '../components/editor/AttachmentCard.vue';
import { Attachment } from '@chuqing/shared';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      insertAttachment: (attrs: Partial<Attachment>) => ReturnType;
    };
  }
}

export const AttachmentExtension = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      originalName: {
        default: '未命名附件',
      },
      size: {
        default: 0,
      },
      category: {
        default: 'other',
      },
      mimeType: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="attachment"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'attachment' })];
  },

  addNodeView() {
    return VueNodeViewRenderer(AttachmentCard);
  },

  addCommands() {
    return {
      insertAttachment:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
