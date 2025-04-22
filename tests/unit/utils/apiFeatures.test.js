const APIFeatures = require('../../../server/utils/apiFeatures');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Product = require('../../../server/models/Product');

describe('APIFeatures', () => {
  let mongoServer;
  let testProducts;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create test data
    testProducts = await Product.create([
      {
        name: 'Product 1',
        price: 100,
        category: 'electronics',
        rating: 4.5,
        createdAt: new Date('2023-01-01'),
      },
      {
        name: 'Product 2',
        price: 200,
        category: 'clothing',
        rating: 3.5,
        createdAt: new Date('2023-01-02'),
      },
      {
        name: 'Premium Product',
        price: 300,
        category: 'electronics',
        rating: 5,
        createdAt: new Date('2023-01-03'),
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('filter()', () => {
    it('should filter by exact match', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { category: 'electronics' }).filter();
      const results = await features.query;

      expect(results.length).toBe(2);
      expect(results.every(p => p.category === 'electronics')).toBe(true);
    });

    it('should handle advanced operators (gt, gte, lt, lte)', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { price: { gte: '150', lt: '250' } }).filter();
      const results = await features.query;

      expect(results.length).toBe(1);
      expect(results[0].price).toBe(200);
    });
  });

  describe('sort()', () => {
    it('should sort by single field', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { sort: 'price' }).sort();
      const results = await features.query;

      expect(results[0].price).toBe(100);
      expect(results[2].price).toBe(300);
    });

    it('should sort by multiple fields', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { sort: 'category,price' }).sort();
      const results = await features.query;

      expect(results[0].category).toBe('clothing');
      expect(results[1].price).toBe(100);
    });

    it('should default to -createdAt if no sort specified', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, {}).sort();
      const results = await features.query;

      expect(results[0].createdAt).toEqual(new Date('2023-01-03'));
    });
  });

  describe('limitFields()', () => {
    it('should limit returned fields', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { fields: 'name,price' }).limitFields();
      const results = await features.query;

      expect(results[0].name).toBeDefined();
      expect(results[0].price).toBeDefined();
      expect(results[0].category).toBeUndefined();
    });

    it('should exclude __v by default', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, {}).limitFields();
      const results = await features.query;

      expect(results[0].__v).toBeUndefined();
    });
  });

  describe('paginate()', () => {
    it('should paginate results', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { page: '2', limit: '1' }).paginate();
      const results = await features.query;

      expect(results.length).toBe(1);
    });

    it('should default to page 1 and limit 100', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, {}).paginate();
      const results = await features.query;

      expect(results.length).toBe(3);
    });
  });

  describe('search()', () => {
    it('should search across specified fields', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { search: 'premium' }).search();
      const results = await features.query;

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Premium Product');
    });

    it('should be case insensitive', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { search: 'PrOdUcT' }).search();
      const results = await features.query;

      expect(results.length).toBe(3);
    });

    it('should search multiple fields when specified', async () => {
      const query = Product.find();
      const features = new APIFeatures(query, { search: 'electronics' }).search([
        'name',
        'category',
      ]);
      const results = await features.query;

      expect(results.length).toBe(2);
    });
  });

  describe('chaining', () => {
    it('should allow method chaining', async () => {
      const results = await new APIFeatures(Product.find(), {
        category: 'electronics',
        sort: '-rating',
        fields: 'name,rating',
        limit: '1',
      })
        .filter()
        .sort()
        .limitFields()
        .paginate().query;

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Premium Product');
      expect(results[0].rating).toBe(5);
      expect(results[0].price).toBeUndefined();
    });
  });
});
