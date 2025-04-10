const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key';

// Middleware
app.use(cors({
    origin: 'https://web-blog-wheat.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  app.options('*', cors({
    origin: 'https://web-blog-wheat.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  app.use(bodyParser.json({ limit: '100mb' }));

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.NODE_ENV === 'production' 
            ? '/tmp/uploads' 
            : path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Serve uploaded images
app.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = process.env.NODE_ENV === 'production' 
        ? `/tmp/uploads/${filename}` 
        : path.join(__dirname, 'public/uploads', filename);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving file:', err);
            res.status(404).json({ message: 'File not found' });
        }
    });
});

// Postgres Database Setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false,
        sslmode: 'require' }
});

// Create tables
const initializeDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS blogs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                category VARCHAR(255),
                author_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                views INTEGER DEFAULT 0,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                blog_id INTEGER,
                user_id INTEGER,
                FOREIGN KEY (blog_id) REFERENCES blogs(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                blog_id INTEGER,
                user_id INTEGER,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                parent_id INTEGER,
                FOREIGN KEY (blog_id) REFERENCES blogs(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
            )
        `);
        console.log('Database tables created successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

// Initialize the database
initializeDatabase();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token malformed' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes

// Sign Up
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    try {
        await pool.query(
            `INSERT INTO users (username, password) VALUES ($1, $2)`,
            [username, hashedPassword]
        );
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(400).json({ message: 'Username already exists' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE username = $1`,
            [username]
        );
        const user = result.rows[0];
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Image Upload Endpoint
app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// Create a Blog Post
app.post('/api/blogs', authenticateToken, async (req, res) => {
    const { title, content, category } = req.body;
    const author_id = req.user.id;
    const created_at = new Date();

    console.log('Received blog creation request:', { title, content, category, author_id, created_at });

    try {
        const result = await pool.query(
            `INSERT INTO blogs (title, content, category, author_id, created_at, views) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [title, content, category, author_id, created_at, 0]
        );
        console.log('Blog created successfully with ID:', result.rows[0].id);
        res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
        console.error('Error inserting blog into database:', err);
        res.status(500).json({ message: `Error creating blog: ${err.message}` });
    }
});

// Get All Blogs
app.get('/api/blogs', async (req, res) => {
    const category = req.query.category;
    let query = `
        SELECT blogs.*, users.username, 
        (SELECT COUNT(*) FROM likes WHERE likes.blog_id = blogs.id) as likes,
        (SELECT COUNT(*) FROM comments WHERE comments.blog_id = blogs.id) as comment_count
        FROM blogs JOIN users ON blogs.author_id = users.id
    `;
    let params = [];

    if (category) {
        query += ` WHERE blogs.category = $1`;
        params.push(category);
    }

    query += ` ORDER BY blogs.created_at DESC`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching blogs:', err);
        res.status(500).json({ message: 'Error fetching blogs' });
    }
});

// Get a Single Blog by ID
app.get('/api/blogs/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Increment views
        await pool.query(`UPDATE blogs SET views = views + 1 WHERE id = $1`, [id]);

        // Fetch the blog
        const blogResult = await pool.query(
            `SELECT blogs.*, users.username 
             FROM blogs JOIN users ON blogs.author_id = users.id 
             WHERE blogs.id = $1`,
            [id]
        );
        const blog = blogResult.rows[0];
        if (!blog) return res.status(404).json({ message: 'Blog not found' });

        // Fetch likes
        const likeResult = await pool.query(
            `SELECT COUNT(*) as likes FROM likes WHERE blog_id = $1`,
            [id]
        );

        // Fetch all comments
        const commentsResult = await pool.query(
            `SELECT comments.*, users.username 
             FROM comments 
             JOIN users ON comments.user_id = users.id 
             WHERE comments.blog_id = $1 
             ORDER BY comments.created_at DESC`,
            [id]
        );
        const allComments = commentsResult.rows;

        // Build nested comment structure
        const commentsMap = {};
        const topLevelComments = [];
        allComments.forEach(comment => {
            comment.replies = [];
            commentsMap[comment.id] = comment;
        });
        allComments.forEach(comment => {
            if (comment.parent_id) {
                if (commentsMap[comment.parent_id]) {
                    commentsMap[comment.parent_id].replies.push(comment);
                }
            } else {
                topLevelComments.push(comment);
            }
        });

        blog.comments = topLevelComments;
        blog.likes = parseInt(likeResult.rows[0].likes);
        res.json(blog);
    } catch (err) {
        console.error('Error fetching blog:', err);
        res.status(500).json({ message: 'Error fetching blog' });
    }
});

// Like a Blog
app.post('/api/blogs/:id/like', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const likeResult = await pool.query(
            `SELECT * FROM likes WHERE blog_id = $1 AND user_id = $2`,
            [id, user_id]
        );
        if (likeResult.rows.length > 0) return res.status(400).json({ message: 'Already liked' });

        await pool.query(
            `INSERT INTO likes (blog_id, user_id) VALUES ($1, $2)`,
            [id, user_id]
        );
        res.json({ message: 'Liked' });
    } catch (err) {
        console.error('Error liking blog:', err);
        res.status(500).json({ message: 'Error liking blog' });
    }
});

// Comment on a Blog
app.post('/api/blogs/:id/comment', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user.id;
    const created_at = new Date();

    try {
        await pool.query(
            `INSERT INTO comments (blog_id, user_id, content, created_at) 
             VALUES ($1, $2, $3, $4)`,
            [id, user_id, content, created_at]
        );
        res.json({ message: 'Comment added' });
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ message: 'Error adding comment' });
    }
});

// Add a Reply to a Comment
app.post('/api/blogs/:id/comment/reply', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { content, parent_id } = req.body;
    const user_id = req.user.id;
    const created_at = new Date();

    try {
        const parentResult = await pool.query(
            `SELECT * FROM comments WHERE id = $1 AND blog_id = $2`,
            [parent_id, id]
        );
        if (parentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Parent comment not found' });
        }

        const result = await pool.query(
            `INSERT INTO comments (blog_id, user_id, content, created_at, parent_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [id, user_id, content, created_at, parent_id]
        );
        res.status(201).json({ message: 'Reply added successfully', commentId: result.rows[0].id });
    } catch (err) {
        console.error('Error adding reply:', err);
        res.status(500).json({ message: 'Error adding reply' });
    }
});

// Get Blogs by User (for manage.html)
app.get('/api/user/blogs', authenticateToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            `SELECT blogs.*, users.username,
             (SELECT COUNT(*) FROM likes WHERE likes.blog_id = blogs.id) as likes,
             (SELECT COUNT(*) FROM comments WHERE comments.blog_id = blogs.id) as comment_count
             FROM blogs JOIN users ON blogs.author_id = users.id
             WHERE blogs.author_id = $1
             ORDER BY blogs.created_at DESC`,
            [user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching user blogs:', err);
        res.status(500).json({ message: 'Error fetching blogs' });
    }
});

// Delete a Blog
app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        const blogResult = await pool.query(
            `SELECT * FROM blogs WHERE id = $1 AND author_id = $2`,
            [id, user_id]
        );
        if (blogResult.rows.length === 0) {
            return res.status(403).json({ message: 'Unauthorized or blog not found' });
        }

        await pool.query(`DELETE FROM blogs WHERE id = $1`, [id]);
        await pool.query(`DELETE FROM likes WHERE blog_id = $1`, [id]);
        await pool.query(`DELETE FROM comments WHERE blog_id = $1`, [id]);
        res.json({ message: 'Blog deleted' });
    } catch (err) {
        console.error('Error deleting blog:', err);
        res.status(500).json({ message: 'Error deleting blog' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});