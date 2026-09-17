// Facade Pattern: Esconde a complexidade do fetch e fornece uma interface simples para a UI
class ApiService {
  constructor() {
    this.baseUrl = 'http://localhost:3000/api';
  }

  async getExpenses() {
    const response = await fetch(`${this.baseUrl}/expenses`);
    if (!response.ok) throw new Error('Erro ao buscar despesas');
    return response.json();
  }

  async createExpense(expenseData) {
    const response = await fetch(`${this.baseUrl}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expenseData)
    });
    if (!response.ok) throw new Error('Erro ao criar despesa');
    return response.json();
  }

  async deleteExpense(id) {
    const response = await fetch(`${this.baseUrl}/expenses/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Erro ao deletar despesa');
  }

  async getBalances() {
    const response = await fetch(`${this.baseUrl}/expenses/balances`);
    if (!response.ok) throw new Error('Erro ao buscar saldos');
    return response.json();
  }
}

// Singleton for easy access
const apiService = new ApiService();
export default apiService;
