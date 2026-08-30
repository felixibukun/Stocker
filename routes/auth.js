const express = require('express')

module.exports = function createRoutes(deps) {
  const router = express.Router()
  const { BCRYPT_ROUNDS, authLimit, bcrypt, loadUsers, saveUsers, setToast } = deps

router.get('/', (req, res) => res.render('index'))

router.get('/signup', (req, res) => res.render('signup'))

router.post('/signup', authLimit, async (req, res) => {
  try {
    const { username, name, email, phone, country, password } = req.body
    const users = loadUsers()

    if (users.find(u => u.username === username)) {
      setToast(req, 'error', 'Username exists')
      return res.redirect('/signup')
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = {
      id: Date.now(),
      username,
      name,
      email,
      phone,
      country,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      balance: 0,
      profit: 0,
      bonus: 0,
      deposit: 0,
      signalLevel: 100,
      verified: false,
      kycStatus: 'not_verified'
    }


    users.push(user)
    saveUsers(users)

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
        setToast(req, 'error', 'Signup error')
        return res.redirect('/signup')
      }
      
      setToast(req, 'success', 'Account created successfully')
      res.redirect('/dashboard')
    })

  } catch (e) {
    console.error('Signup error:', e)
    setToast(req, 'error', 'Signup error')
    res.redirect('/signup')
  }
})

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard')
  
  // Check if password was changed
  const passwordChanged = req.query.passwordChanged === 'true'
  
  res.render('login', { 
    passwordChanged 
  })
})

router.post('/login', authLimit, async (req, res) => {
  try {
    const { username, password } = req.body
    const users = loadUsers()

    function failLogin() {
      setToast(req, 'error', 'Invalid login')
      return res.redirect('/login')
    }

    const user = users.find(u => u.username === username)
    if (!user) {
      return failLogin()
    }

    // Check password - supports both plain text and bcrypt
    let passwordValid = false
    
    if (user.password === password) {
      passwordValid = true
      user.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
      saveUsers(users)
    } else {
      try {
        passwordValid = await bcrypt.compare(password, user.password)
      } catch (err) {
        passwordValid = false
      }
    }
    
    if (!passwordValid) {
      return failLogin()
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
        setToast(req, 'error', 'Login error')
        return res.redirect('/login')
      }
      setToast(req, 'success', 'Login successful')
      res.redirect('/dashboard')
    })

  } catch (e) {
    console.error('Login error:', e)
    setToast(req, 'error', 'Login error')
    res.redirect('/login')
  }
})

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
    }
    res.redirect('/login')
  })
})



  return router
}
