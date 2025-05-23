const API_URL = 'https://web-blog-afow.vercel.app';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and script running');

    // Profile Dropdown
    window.toggleProfileMenu = function () {
        console.log('toggleProfileMenu called');
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) {
            console.log('Profile menu found, current display:', profileMenu.style.display);
            profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
            console.log('New display:', profileMenu.style.display);
        } else {
            console.error('Profile menu element not found');
        }
    };

    // Categories Dropdown for the icon
    window.toggleCategoriesMenu = function () {
        console.log('toggleCategoriesMenu called');
        const categoriesMenu = document.getElementById('categoriesMenu');
        if (categoriesMenu) {
            console.log('Categories menu found, current display:', categoriesMenu.style.display);
            categoriesMenu.style.display = categoriesMenu.style.display === 'block' ? 'none' : 'block';
            console.log('New display:', categoriesMenu.style.display);
        } else {
            console.error('Categories menu element not found');
        }
    };

    // Hamburger Menu Toggle
    window.toggleMenu = function () {
        console.log('toggleMenu called');
        const navMenu = document.getElementById('navMenu');
        if (navMenu) {
            console.log('Nav menu found, current display:', navMenu.style.display);
            navMenu.style.display = navMenu.style.display === 'block' ? 'none' : 'block';
            console.log('New display:', navMenu.style.display);
        } else {
            console.error('Nav menu element not found');
        }
    };

    window.logout = function () {
        console.log('Logout called');
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    };

    // Token-based visibility logic
    const token = localStorage.getItem('token');
    const profileElement = document.querySelector('.profile');
    const authButtons = document.getElementById('authButtons');
    if (token) {
        console.log('User is logged in, token:', token);
        if (profileElement) {
            profileElement.style.display = 'block';
            console.log('Profile element shown');
        }
        if (authButtons) {
            authButtons.style.display = 'none';
            console.log('Auth buttons hidden');
        }
        const commentForm = document.getElementById('commentForm');
        if (commentForm) commentForm.style.display = 'block';
    } else {
        console.log('No token found, showing login and signup buttons');
        if (profileElement) {
            profileElement.style.display = 'none';
        }
        if (authButtons) {
            authButtons.style.display = 'block';
        }
    }

    // Attach event listeners for login/signup
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        console.log('Login button clicked');
        window.location.href = 'login.html';
    });

    document.getElementById('signupBtn')?.addEventListener('click', () => {
        console.log('Signup button clicked');
        window.location.href = 'signup.html';
    });

    // Initialize Quill Editor on create.html
    if (window.location.pathname.endsWith('create.html')) {
        if (typeof Quill !== 'undefined') {
            const quill = new Quill('#editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ header: [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        ['link', 'image', 'video'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['clean']
                    ]
                }
            });
            console.log('Quill editor initialized');
        } else {
            console.error('Quill library not loaded');
        }
    }

    // Handle Sign Up
    if (window.location.pathname.endsWith('signup.html')) {
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await fetch(`${API_URL}/api/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    alert(data.message);
                    if (response.status === 201) window.location.href = 'login.html';
                } catch (error) {
                    console.error('Error during signup:', error);
                    alert('Failed to sign up. Check the console for details.');
                }
            });
        }
    }

    // Handle Login
    if (window.location.pathname.endsWith('login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await fetch(`${API_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        localStorage.setItem('token', data.token);
                        window.location.href = 'index.html';
                    } else {
                        alert(data.message);
                    }
                } catch (error) {
                    console.error('Error during login:', error);
                    alert('Failed to log in. Check the console for details.');
                }
            });
        }
    }

    // Handle Create Blog with Quill Content
    if (window.location.pathname.endsWith('create.html')) {
        const createBlogForm = document.getElementById('createBlogForm');
        if (createBlogForm) {
            createBlogForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Create Blog form submitted');

                const title = document.getElementById('title').value;
                const category = document.getElementById('category').value;
                const content = document.querySelector('.ql-editor')?.innerHTML || '';

                const token = localStorage.getItem('token');
                if (!token) {
                    alert('No token found. Please log in again.');
                    window.location.href = 'login.html';
                    return;
                }

                try {
                    const response = await fetch(`${API_URL}/api/blogs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token.trim()}`
                        },
                        body: JSON.stringify({ title, category, content })
                    });

                    let data;
                    try {
                        data = await response.json();
                    } catch {
                        const text = await response.text();
                        console.error('Expected JSON but got:', text);
                        alert('Server error or invalid response.');
                        return;
                    }

                    if (response.status === 403 && data.message === 'Invalid token') {
                        alert('Your session has expired. Please log in again.');
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }

                    alert(response.ok ? 'Blog created!' : `Error creating blog: ${data.message || 'Unknown error'}`);
                    if (response.ok) window.location.href = 'index.html';
                } catch (error) {
                    console.error('Error creating blog:', error);
                    alert('Failed to create blog. Check the console for details.');
                }
            });
        }
    }

    // Fetch and Display Blogs
    if (window.location.pathname.endsWith('index.html')) {
        window.fetchAndRenderBlogs = async function (category = '') {
            try {
                const response = await fetch(`${API_URL}/api/blogs${category ? `?category=${category}` : ''}`);
                const blogs = await response.json();
                console.log('Fetched Blogs:', blogs);
                const blogsList = document.getElementById('blogsList');
                blogsList.innerHTML = blogs.map(blog => `
                    <div class="blog-card">
                        <h3><a href="blog.html?id=${blog.id}">${blog.title}</a></h3>
                        <p>By ${blog.username} on ${new Date(blog.created_at).toLocaleDateString()}</p>
                        <div class="metrics">
                            <span>Likes: ${blog.likes || 0}</span>
                            <span>Comments: ${blog.comment_count || 0}</span>
                            <span>Views: ${blog.views || 0}</span>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error fetching blogs:', error);
            }
        };
        fetchAndRenderBlogs();
    }

    // Fetch and Display a Single Blog
    if (window.location.pathname.endsWith('blog.html')) {
        const fetchBlog = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}`);
                const blog = await response.json();

                document.getElementById('blogTitle').textContent = blog.title;
                document.getElementById('blogAuthor').textContent = blog.username;
                document.getElementById('blogDate').textContent = new Date(blog.created_at).toLocaleDateString();
                document.getElementById('blogContent').innerHTML = blog.content;
                document.getElementById('likeCount').textContent = blog.likes || 0;

                const commentsList = document.getElementById('commentsList');
                const token = localStorage.getItem('token'); // Check if user is logged in

                // Render comments and their replies
                const renderComments = (comments, parentElement) => {
                    comments.forEach(comment => {
                        const commentElement = document.createElement('div');
                        commentElement.classList.add('comment');
                        commentElement.innerHTML = `
                            <p>
                                <span class="comment-author">${comment.username}</span>
                                <span class="comment-date"> on ${new Date(comment.created_at).toLocaleDateString()}</span>
                            </p>
                            <p class="comment-content">${comment.content}</p>
                            <button class="reply-btn" id="replyBtn-${comment.id}">Reply</button>
                            <form class="reply-form" id="replyForm-${comment.id}" style="display:none;">
                                <textarea placeholder="Reply to this comment..." required></textarea>
                                <button type="submit" class="submit-btn">Reply</button>
                            </form>
                            <div class="replies"></div>
                        `;

                        // Add event listener for the "Reply" button
                        const replyBtn = commentElement.querySelector(`#replyBtn-${comment.id}`);
                        const replyForm = commentElement.querySelector(`#replyForm-${comment.id}`);
                        replyBtn.addEventListener('click', () => {
                            if (!token) {
                                alert('Please log in to reply to comments.');
                                window.location.href = 'login.html';
                                return;
                            }
                            replyForm.style.display = replyForm.style.display === 'block' ? 'none' : 'block';
                        });

                        // Handle reply form submission
                        replyForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const replyContent = replyForm.querySelector('textarea').value;

                            try {
                                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comments/reply`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ content: replyContent, parent_id: comment.id })
                                });

                                let data;
                                try {
                                    data = await response.json();
                                } catch {
                                    const text = await response.text();
                                    console.error('Expected JSON but got:', text);
                                    alert('Server error or invalid response.');
                                    return;
                                }

                                alert(data.message);
                                if (response.ok) {
                                    replyForm.querySelector('textarea').value = '';
                                    replyForm.style.display = 'none';
                                    fetchBlog(); // Refresh comments
                                }
                            } catch (error) {
                                console.error('Error adding reply:', error);
                                alert('Failed to add reply. Check the console.');
                            }
                        });

                        // Render replies recursively
                        if (comment.replies && comment.replies.length > 0) {
                            renderComments(comment.replies, commentElement.querySelector('.replies'));
                        }

                        parentElement.appendChild(commentElement);
                    });
                };

                commentsList.innerHTML = ''; // Clear existing comments
                renderComments(blog.comments || [], commentsList);

                // Like button handler
                const likeBtn = document.getElementById('likeBtn');
                likeBtn.onclick = async () => {
                    if (!token) {
                        alert('Please log in to like posts.');
                        window.location.href = 'login.html';
                        return;
                    }
                    try {
                        const response = await fetch(`${API_URL}/api/blogs/${blogId}/like`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await response.json();
                        alert(data.message);
                        if (response.ok) fetchBlog();
                    } catch (error) {
                        console.error('Error liking blog:', error);
                    }
                };
            } catch (error) {
                console.error('Error fetching blog:', error);
            }
        };

        fetchBlog();

        // Comment form submission handler
        document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            const content = document.getElementById('commentContent').value;
            const token = localStorage.getItem('token');

            if (!token) {
                alert('Please log in to comment.');
                window.location.href = 'login.html';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ content })
                });

                let data;
                try {
                    data = await response.json();
                } catch {
                    const text = await response.text();
                    console.error('Expected JSON but got:', text);
                    alert('Server error or invalid response.');
                    return;
                }

                alert(data.message || 'Comment added!');

                if (response.ok) {
                    document.getElementById('commentContent').value = '';
                    fetchBlog();
                }
            } catch (error) {
                console.error('Error adding comment:', error);
                alert('Failed to add comment. Check the console.');
            }
        });
    }
});
