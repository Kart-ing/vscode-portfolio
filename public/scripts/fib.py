def fib(n):
    """Yield the first n Fibonacci numbers."""
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b


numbers = list(fib(15))

print("First 15 Fibonacci numbers:")
print(", ".join(str(n) for n in numbers))
