const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (useSupabase) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  console.log('Using live Supabase Database integration');
} else {
  console.log('Supabase credentials missing. Running in local JSON database mode.');
}

const mockDbPath = path.join(__dirname, '..', '..', 'database', 'mock_db.json');

// Ensure database directory exists
const dbDir = path.dirname(mockDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initial seed data
const initialData = {
  profiles: [
    { id: 'usr-admin', email: 'admin@marketplace.com', full_name: 'Super Admin', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', role: 'super_admin', reward_points: 500, referral_code: 'SUPERAD100', referred_by: null, created_at: new Date().toISOString() },
    { id: 'usr-seller1', email: 'techstore@marketplace.com', full_name: 'Apex Electronics Inc.', avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', role: 'seller', reward_points: 100, referral_code: 'APEX123', referred_by: null, created_at: new Date().toISOString() },
    { id: 'usr-seller2', email: 'fashionhub@marketplace.com', full_name: 'Sarah Jenkins', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', role: 'seller', reward_points: 120, referral_code: 'SARAHVOGUE', referred_by: null, created_at: new Date().toISOString() },
    { id: 'usr-customer', email: 'customer@marketplace.com', full_name: 'John Doe', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80', role: 'customer', reward_points: 250, referral_code: 'JOHNDOE5', referred_by: null, created_at: new Date().toISOString() }
  ],
  stores: [
    {
      id: 'usr-seller1',
      name: 'Apex Electronics',
      description: 'Your premier shop for cutting edge gadgets, smart home equipment, and high-performance computing.',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80',
      banner_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=400&q=80',
      rating: 4.85,
      followers_count: 342,
      policies: { shipping: 'Ships within 24 hours. Express option available.', returns: '30-day money back guarantee.' },
      social_links: { twitter: 'https://twitter.com/apexelectronics', website: 'https://apex.market' },
      is_approved: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'usr-seller2',
      name: 'Vogue Apparel',
      description: 'Premium curated styles, organic fabrics, and sustainable chic fashion for everyday comfort.',
      logo_url: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=200&h=200&q=80',
      banner_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&h=400&q=80',
      rating: 4.65,
      followers_count: 512,
      policies: { shipping: 'Free shipping on orders over $50.', returns: 'Hassle-free 14-day exchange policy.' },
      social_links: { instagram: 'https://instagram.com/vogueapparel', website: 'https://vogue-apparel.com' },
      is_approved: true,
      created_at: new Date().toISOString()
    }
  ],
  categories: [],
  brands: [],
  products: [],
  product_variants: [],
  coupons: [],
  orders: [],
  order_items: [],
  order_tracking: [],
  reviews: [],
  chat_messages: [],
  wishlists: [],
  support_tickets: [],
  support_ticket_messages: [],
  payouts: [],
  store_followers: [],
  announcements: []
};

// Database utility methods
const db = {
  // Load mock DB state
  getData() {
    if (!fs.existsSync(mockDbPath)) {
      fs.writeFileSync(mockDbPath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    try {
      const content = fs.readFileSync(mockDbPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error reading mock_db.json, recreating...', err);
      fs.writeFileSync(mockDbPath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
  },

  // Save mock DB state
  saveData(data) {
    fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));
  },

  // Select entries from table
  async select(table, filters = {}) {
    if (useSupabase) {
      let query = supabase.from(table).select('*');
      for (const [key, val] of Object.entries(filters)) {
        query = query.eq(key, val);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } else {
      const data = this.getData();
      const list = data[table] || [];
      return list.filter(item => {
        for (const [k, v] of Object.entries(filters)) {
          if (item[k] !== v) return false;
        }
        return true;
      });
    }
  },

  // Get single entry from table
  async selectOne(table, filters = {}) {
    const list = await this.select(table, filters);
    return list[0] || null;
  },

  // Insert entry into table
  async insert(table, record) {
    if (useSupabase) {
      const { data, error } = await supabase.from(table).insert([record]).select();
      if (error) throw error;
      return data[0];
    } else {
      const dbData = this.getData();
      if (!dbData[table]) dbData[table] = [];
      const newRecord = { id: record.id || `gen-${Math.random().toString(36).substr(2, 9)}`, ...record, created_at: record.created_at || new Date().toISOString() };
      dbData[table].push(newRecord);
      this.saveData(dbData);
      return newRecord;
    }
  },

  // Update entry in table
  async update(table, filters = {}, updates = {}) {
    if (useSupabase) {
      let query = supabase.from(table).update(updates);
      for (const [k, v] of Object.entries(filters)) {
        query = query.eq(k, v);
      }
      const { data, error } = await query.select();
      if (error) throw error;
      return data;
    } else {
      const dbData = this.getData();
      const list = dbData[table] || [];
      let updatedCount = 0;
      const updatedList = list.map(item => {
        let match = true;
        for (const [k, v] of Object.entries(filters)) {
          if (item[k] !== v) {
            match = false;
            break;
          }
        }
        if (match) {
          updatedCount++;
          return { ...item, ...updates };
        }
        return item;
      });
      dbData[table] = updatedList;
      this.saveData(dbData);
      return updatedList.filter(item => {
        for (const [k, v] of Object.entries(filters)) {
          if (item[k] !== v) return false;
        }
        return true;
      });
    }
  },

  // Delete entry in table
  async delete(table, filters = {}) {
    if (useSupabase) {
      let query = supabase.from(table).delete();
      for (const [k, v] of Object.entries(filters)) {
        query = query.eq(k, v);
      }
      const { data, error } = await query.select();
      if (error) throw error;
      return data;
    } else {
      const dbData = this.getData();
      const list = dbData[table] || [];
      const beforeCount = list.length;
      const filtered = list.filter(item => {
        let match = true;
        for (const [k, v] of Object.entries(filters)) {
          if (item[k] !== v) {
            match = false;
            break;
          }
        }
        return !match;
      });
      dbData[table] = filtered;
      this.saveData(dbData);
      return { deleted: beforeCount - filtered.length };
    }
  }
};

db.supabase = supabase;
db.useSupabase = useSupabase;

module.exports = db;

