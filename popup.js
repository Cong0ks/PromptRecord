// 提示词记录器 - 主逻辑

// 数据模型
// {
//   id: string (UUID),
//   title: string,
//   content: string,
//   category: string,
//   groups: string[],
//   createdAt: string (ISO 8601),
//   updatedAt: string (ISO 8601)
// }

class PromptManager {
  constructor() {
    this.prompts = [];
    this.currentFilter = {
      search: '',
      category: '',
      group: ''
    };
    this.init();
  }

  async init() {
    await this.loadPrompts();
    this.bindEvents();
    this.render();
    this.updateFilters();
  }

  // 从 Chrome Storage 加载数据
  async loadPrompts() {
    const result = await chrome.storage.local.get(['prompts']);
    this.prompts = result.prompts || [];
  }

  // 保存到 Chrome Storage
  async savePrompts() {
    await chrome.storage.local.set({ prompts: this.prompts });
  }

  // 生成 UUID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 获取所有唯一的分类
  getCategories() {
    const categories = new Set();
    this.prompts.forEach(prompt => {
      if (prompt.category) {
        categories.add(prompt.category);
      }
    });
    return Array.from(categories).sort();
  }

  // 获取所有唯一的组标签
  getGroups() {
    const groups = new Set();
    this.prompts.forEach(prompt => {
      if (prompt.groups) {
        prompt.groups.forEach(group => groups.add(group));
      }
    });
    return Array.from(groups).sort();
  }

  // 添加提示词
  async addPrompt(data) {
    const now = new Date().toISOString();
    const prompt = {
      id: this.generateId(),
      title: data.title,
      content: data.content,
      category: data.category || '未分类',
      groups: data.groups ? data.groups.split(',').map(g => g.trim()).filter(g => g) : [],
      createdAt: now,
      updatedAt: now
    };
    this.prompts.unshift(prompt);
    await this.savePrompts();
    this.render();
    this.updateFilters();
  }

  // 更新提示词
  async updatePrompt(id, data) {
    const index = this.prompts.findIndex(p => p.id === id);
    if (index !== -1) {
      this.prompts[index] = {
        ...this.prompts[index],
        title: data.title,
        content: data.content,
        category: data.category || '未分类',
        groups: data.groups ? data.groups.split(',').map(g => g.trim()).filter(g => g) : [],
        updatedAt: new Date().toISOString()
      };
      await this.savePrompts();
      this.render();
      this.updateFilters();
    }
  }

  // 删除提示词
  async deletePrompt(id) {
    this.prompts = this.prompts.filter(p => p.id !== id);
    await this.savePrompts();
    this.render();
    this.updateFilters();
  }

  // 获取过滤后的提示词
  getFilteredPrompts() {
    return this.prompts.filter(prompt => {
      // 搜索过滤
      if (this.currentFilter.search) {
        const searchLower = this.currentFilter.search.toLowerCase();
        const matchTitle = prompt.title.toLowerCase().includes(searchLower);
        const matchContent = prompt.content.toLowerCase().includes(searchLower);
        if (!matchTitle && !matchContent) return false;
      }

      // 分类过滤
      if (this.currentFilter.category && prompt.category !== this.currentFilter.category) {
        return false;
      }

      // 组过滤
      if (this.currentFilter.group) {
        if (!prompt.groups || !prompt.groups.includes(this.currentFilter.group)) {
          return false;
        }
      }

      return true;
    });
  }

  // 格式化日期
  formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    // 小于1天
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      if (hours === 0) {
        const minutes = Math.floor(diff / 60000);
        return minutes === 0 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    }

    // 小于7天
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}天前`;
    }

    // 其他情况显示完整日期
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // 渲染提示词列表
  render() {
    const listEl = document.getElementById('promptList');
    const emptyEl = document.getElementById('emptyState');
    const filtered = this.getFilteredPrompts();

    if (filtered.length === 0) {
      listEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.style.display = 'block';
    emptyEl.style.display = 'none';

    listEl.innerHTML = filtered.map(prompt => `
      <div class="prompt-item" data-id="${prompt.id}">
        <div class="prompt-header">
          <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
          <div class="prompt-date">${this.formatDate(prompt.createdAt)}</div>
        </div>
        <div class="prompt-content">${this.escapeHtml(prompt.content)}</div>
        <div class="prompt-tags">
          <span class="tag tag-category">${this.escapeHtml(prompt.category)}</span>
          ${(prompt.groups || []).map(group =>
            `<span class="tag tag-group">${this.escapeHtml(group)}</span>`
          ).join('')}
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    listEl.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.openEditModal(id);
      });
    });
  }

  // 更新筛选器选项
  updateFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const groupFilter = document.getElementById('groupFilter');
    const categoryList = document.getElementById('categoryList');

    // 保存当前选择
    const currentCategory = categoryFilter.value;
    const currentGroup = groupFilter.value;

    // 更新分类筛选器
    const categories = this.getCategories();
    categoryFilter.innerHTML = '<option value="">全部分类</option>' +
      categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    // 更新组筛选器
    const groups = this.getGroups();
    groupFilter.innerHTML = '<option value="">全部组</option>' +
      groups.map(group => `<option value="${group}">${group}</option>`).join('');

    // 更新分类数据列表（用于输入建议）
    categoryList.innerHTML = categories.map(cat =>
      `<option value="${cat}">`
    ).join('');

    // 恢复选择
    categoryFilter.value = currentCategory;
    groupFilter.value = currentGroup;
  }

  // HTML 转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 打开编辑模态框
  openEditModal(id) {
    const prompt = this.prompts.find(p => p.id === id);
    if (!prompt) return;

    document.getElementById('modalTitle').textContent = '编辑提示词';
    document.getElementById('promptId').value = prompt.id;
    document.getElementById('title').value = prompt.title;
    document.getElementById('content').value = prompt.content;
    document.getElementById('category').value = prompt.category;
    document.getElementById('groups').value = (prompt.groups || []).join(', ');
    document.getElementById('deleteBtn').style.display = 'block';

    document.getElementById('editModal').style.display = 'flex';
  }

  // 打开新建模态框
  openAddModal() {
    document.getElementById('modalTitle').textContent = '新建提示词';
    document.getElementById('promptForm').reset();
    document.getElementById('promptId').value = '';
    document.getElementById('deleteBtn').style.display = 'none';

    document.getElementById('editModal').style.display = 'flex';
  }

  // 关闭模态框
  closeModal() {
    document.getElementById('editModal').style.display = 'none';
  }

  // 绑定事件
  bindEvents() {
    // 添加按钮
    document.getElementById('addBtn').addEventListener('click', () => {
      this.openAddModal();
    });

    document.getElementById('addFirstBtn').addEventListener('click', () => {
      this.openAddModal();
    });

    // 关闭模态框
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });

    // 点击模态框外部关闭
    document.getElementById('editModal').addEventListener('click', (e) => {
      if (e.target.id === 'editModal') {
        this.closeModal();
      }
    });

    // 表单提交
    document.getElementById('promptForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        title: document.getElementById('title').value,
        content: document.getElementById('content').value,
        category: document.getElementById('category').value,
        groups: document.getElementById('groups').value
      };

      const id = document.getElementById('promptId').value;

      if (id) {
        await this.updatePrompt(id, data);
      } else {
        await this.addPrompt(data);
      }

      this.closeModal();
    });

    // 删除按钮
    document.getElementById('deleteBtn').addEventListener('click', async () => {
      const id = document.getElementById('promptId').value;
      if (confirm('确定要删除这个提示词吗？')) {
        await this.deletePrompt(id);
        this.closeModal();
      }
    });

    // 搜索输入
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.currentFilter.search = e.target.value;
      this.render();
    });

    // 分类筛选
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.currentFilter.category = e.target.value;
      this.render();
    });

    // 组筛选
    document.getElementById('groupFilter').addEventListener('change', (e) => {
      this.currentFilter.group = e.target.value;
      this.render();
    });
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PromptManager();
});
