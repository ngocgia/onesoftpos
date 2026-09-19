const DEFAULT_WORKFLOW = {
  name: 'Thu ngân - Bếp - Thanh toán',
  steps: [
    { id: 'create', name: 'Thu ngân tạo đơn', type: 'CREATE', roles: ['CASHIER'] },
    { id: 'kitchen', name: 'Bếp chế biến', type: 'KITCHEN', roles: ['KITCHEN'] },
    { id: 'payment', name: 'Thu ngân thanh toán', type: 'PAYMENT', roles: ['CASHIER'] }
  ]
};

const STEP_TYPES = ['CREATE', 'APPROVAL', 'KITCHEN', 'PAYMENT'];

function normalizeWorkflow(value) {
  let workflow = value;
  if (typeof workflow === 'string') {
    try { workflow = JSON.parse(workflow); } catch (_) { workflow = null; }
  }
  if (!workflow || !Array.isArray(workflow.steps) || !workflow.steps.length) return JSON.parse(JSON.stringify(DEFAULT_WORKFLOW));
  return {
    name: String(workflow.name || 'Luồng vận hành'),
    steps: workflow.steps.map((step, index) => ({
      id: String(step.id || `step_${index + 1}`),
      name: String(step.name || `Bước ${index + 1}`),
      type: String(step.type || '').toUpperCase(),
      roles: Array.isArray(step.roles) ? [...new Set(step.roles.map(String))] : []
    }))
  };
}

function validateWorkflow(value) {
  const workflow = normalizeWorkflow(value);
  if (workflow.steps.length < 2) return { valid: false, message: 'Luồng phải có ít nhất 2 bước' };
  if (workflow.steps[0].type !== 'CREATE') return { valid: false, message: 'Bước đầu tiên phải là Tạo đơn' };
  if (workflow.steps.filter(step => step.type === 'CREATE').length !== 1) return { valid: false, message: 'Luồng chỉ được có một bước Tạo đơn' };
  if (!workflow.steps.some(step => step.type === 'PAYMENT')) return { valid: false, message: 'Luồng phải có bước Thanh toán' };
  if (workflow.steps.some(step => !STEP_TYPES.includes(step.type))) return { valid: false, message: 'Luồng có loại bước không hợp lệ' };
  if (workflow.steps.some(step => !step.roles.length)) return { valid: false, message: 'Mỗi bước phải có ít nhất một nhóm xử lý' };
  const ids = workflow.steps.map(step => step.id);
  if (new Set(ids).size !== ids.length) return { valid: false, message: 'Mã các bước không được trùng nhau' };
  return { valid: true, workflow };
}

function currentStep(workflowValue, stageIndex) {
  const workflow = normalizeWorkflow(workflowValue);
  return workflow.steps[Number(stageIndex) || 0] || null;
}

function resolveStageIndex(workflowValue, storedIndex, orderStatus, hasSnapshot = true) {
  const workflow = normalizeWorkflow(workflowValue);
  if (hasSnapshot) return Number(storedIndex) || 0;
  if (orderStatus === 'PENDING_CONFIRMATION') return Math.max(0, workflow.steps.findIndex(step => step.type === 'APPROVAL'));
  if (['CONFIRMED', 'PREPARING'].includes(orderStatus)) return Math.max(0, workflow.steps.findIndex(step => step.type === 'KITCHEN'));
  if (orderStatus === 'READY') return Math.max(0, workflow.steps.findIndex(step => step.type === 'PAYMENT'));
  if (['COMPLETED', 'CANCELLED'].includes(orderStatus)) return workflow.steps.length;
  return Number(storedIndex) || 0;
}

function roleCanHandle(step, role) {
  return !!step && (role === 'SUPER_ADMIN' || step.roles.includes(role));
}

function legacyStatusForStep(step, paymentStatus = 'UNPAID') {
  if (!step) return 'COMPLETED';
  if (step.type === 'APPROVAL') return 'PENDING_CONFIRMATION';
  if (step.type === 'KITCHEN') return 'CONFIRMED';
  if (step.type === 'PAYMENT') return paymentStatus === 'PAID' ? 'COMPLETED' : 'READY';
  return 'CONFIRMED';
}

module.exports = { DEFAULT_WORKFLOW, STEP_TYPES, normalizeWorkflow, validateWorkflow, currentStep, resolveStageIndex, roleCanHandle, legacyStatusForStep };
