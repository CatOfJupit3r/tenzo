/**
 * DI Tokens for Interface-Based Injection
 *
 * This file demonstrates the token pattern for when you need to inject
 * INTERFACES instead of concrete classes. With emitDecoratorMetadata enabled,
 * concrete classes can be injected directly without tokens.
 *
 * When to use tokens:
 * - Injecting an interface with multiple possible implementations
 * - Swapping implementations for testing
 * - Plugin/strategy patterns
 *
 * When NOT to use tokens (use class directly):
 * - Injecting a concrete class with @singleton() or @injectable()
 * - The class is the only implementation of itself
 *
 * @example Token-based injection for interfaces:
 * ```typescript
 * // Define interface
 * interface iPaymentService {
 *   processPayment(amount: number): Promise<void>;
 * }
 *
 * // Create unique token
 * export const PAYMENT_SERVICE_TOKEN = Symbol.for('PaymentService');
 *
 * // Register implementation
 * container.registerSingleton<iPaymentService>(PAYMENT_SERVICE_TOKEN, StripePaymentService);
 *
 * // Inject via token
 * @injectable()
 * class CheckoutService {
 *   constructor(@inject(PAYMENT_SERVICE_TOKEN) private payment: iPaymentService) {}
 * }
 *
 * // Or resolve manually
 * const payment = container.resolve<iPaymentService>(PAYMENT_SERVICE_TOKEN);
 * ```
 *
 * @example Direct class injection (preferred for concrete classes):
 * ```typescript
 * @singleton()
 * class DatabaseService {
 *   async connect() { ... }
 * }
 *
 * @injectable()
 * class UserService {
 *   // tsyringe infers DatabaseService from parameter type
 *   constructor(private db: DatabaseService) {}
 * }
 *
 * // Or resolve manually
 * const db = container.resolve(DatabaseService);
 * ```
 */

// Example token for interface-based injection (uncomment and modify as needed):
// export const EXAMPLE_SERVICE_TOKEN = Symbol.for('ExampleService');
