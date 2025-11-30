document.addEventListener('submit', async function(event) {
  const form = event.target

  if (form.method.toLowerCase() !== 'post') return

  event.preventDefault()

  const data = new FormData(form)

  const response = await fetch(form.action, {
    method: 'POST',
    body: data
  })

  let result
  try {
    result = await response.json()
  } catch {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Server returned invalid response'
    })
    return
  }

  if (!result.success) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: result.message
    })
    return
  }

  Swal.fire({
    icon: 'success',
    title: 'Success',
    text: result.message
  }).then(() => {
    if (result.redirect) {
      window.location.href = result.redirect
    } else {
      window.location.reload()
    }
  })
})
