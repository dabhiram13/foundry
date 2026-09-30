# Checkout Flow

Verify:
- user can enter checkout
- cancel path returns safely
- success path returns safely
- wrong-user ownership is not granted
- duplicate confirmation is harmless

Check both:
- browser-visible outcome
- provider/session state if available

Keep evidence short:
- URL reached
- visible state
- exact failure if broken
