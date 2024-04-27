/**
 * The errors module extends the built-in Error class to provide
 * additional functionality such as:
 *
 * - `toObject()` method to convert an error to JSON
 *    object.
 * - `set()` method to set multiple properties of the error.
 * - `stackTrace` property to get the stack trace as an array of strings.
 * - `code` property to get or set the error code.
 * - `target` property to get or set the target of the error
 *    such as the name of the method that threw the error.
 *
 * The module also provides a number of error classes that extend
 * and utility functions to work with errors:
 * - `collectError()` function to collect all the errors from an error object.
 * - `walkError()` function to walk through an error and its inner errors.
 * - `printError()` function to print an error to the console.
 *
 * @module
 */

/**
 * Represents the properties of an error.
 */
export interface ErrorProps extends InnerError {
    /**
     * The error message.
     */
    readonly message?: string;

    /**
     * The target of the error.
     */
    readonly target?: string;

    /**
     * Additional details about the error.
     */
    details?: ErrorProps[];
}

/**
 * Represents an inner error.
 */
export interface InnerError extends Record<string, unknown> {
    /**
     * The error code.
     */
    readonly code?: string;

    /**
     * The inner error.
     */
    readonly innerError?: InnerError;
}

function from(e: Error): SystemError {
    if (e instanceof globalThis.AggregateError) {
        return AggregateError.from(e);
    }

    const exception = new SystemError(e.message, e.cause);
    exception.stack = e.stack;
    return exception;
}

/**
 * Represents a system error.
 * Extends the built-in Error class.
 */
export class SystemError extends Error {
    override name = "SystemError";
    #innerError?: SystemError;
    #code?: string;

    #target?: string;

    /**
     * The link to the documentation for the error.
     */
    link?: string | URL;

    #stackLines?: string[];

    constructor(message: string, innerError?: Error | unknown) {
        super(message);

        this.cause = innerError;
        if (innerError === undefined) {
            return;
        }

        if (this.cause instanceof SystemError) {
            this.#innerError = this.cause;
            return;
        }

        if (this.cause instanceof Error) {
            this.#innerError = from(this.cause);
        }
    }

    /**
     * The error code.
     */
    get code(): string | undefined {
        return this.#code ?? this.name;
    }

    set code(value: string | undefined) {
        this.#code = value;
    }

    /**
     * The target of the error. Often used to store the
     * name of the method that threw the error.
     */
    get target(): string | undefined {
        return this.#target;
    }

    set target(value: string | undefined) {
        this.#target = value;
    }

    /**
     * The inner error.
     */
    get innerError(): SystemError | undefined {
        return this.#innerError;
    }

    /**
     * Sets the properties of the error.
     * @param props The properties to set.
     * @returns The error instance.
     */
    set(props: Partial<this>): this {
        for (const [key, value] of Object.entries(props)) {
            if (key === "name" || key === "stack") {
                continue;
            }

            if (Object.hasOwn(this, key)) {
                // @ts-ignore. between the Partial and Object.hasOwn, this is a valid property
                this[key] = value;
            }
        }

        return this;
    }

    set stack(value: string | undefined) {
        this.#stackLines = undefined;
        super.stack = value;
    }

    /**
     * The stack trace of the error. This is a read-only property
     * that removes the message and only returns the stack trace
     * as an array of strings.
     */
    get stackTrace(): string[] {
        if (!this.#stackLines) {
            if (this.stack) {
                this.#stackLines = this.stack.split("\n").map((line) => line.trim())
                    .filter((o) => o.startsWith("at "));
            } else {
                this.#stackLines = [];
            }
        }

        return this.#stackLines;
    }

    set stackTrace(value: string[]) {
        this.#stackLines = value;
        super.stack = value.join("\n");
    }

    /**
     * Converts the error to an object.
     * @returns The error as an object.
     */
    toObject(): ErrorProps {
        return {
            message: this.message,
            code: this.code,
            target: this.target,
            innerError: this.innerError?.toObject(),
        };
    }
}

/**
 * Represents an aggregate error that contains multiple errors.
 */
export class AggregateError extends SystemError {
    /**
     * The errors that occurred.
     */
    errors: SystemError[];

    /**
     * Creates a new instance of the AggregateError class.
     * @param message - The error message.
     * @param errors - The errors that occurred.
     * @param innerError - The inner error.
     */
    constructor(message?: string, errors?: SystemError[], innerError?: Error) {
        super(message ?? "One or more errors occurred.", innerError);
        this.name = "AggregateError";
        this.errors = errors ?? [];
    }

    /**
     * Converts the AggregateError instance to an object representation.
     * @returns The object representation of the AggregateError.
     */
    override toObject(): ErrorProps {
        return {
            ...super.toObject(),
            details: this.errors.map((o) => o.toObject()),
        };
    }

    /**
     * Creates an AggregateError instance from an existing AggregateError.
     * @param error - The existing AggregateError instance.
     * @returns A new AggregateError instance.
     */
    static from(error: globalThis.AggregateError): AggregateError {
        const innerError = error?.cause !== undefined && error.cause instanceof Error ? from(error.cause) : error;
        return new AggregateError(
            error.message,
            error.errors.map((o) => from(o)),
            innerError,
        );
    }
}

/**
 * Represents an error that occurs when an invalid argument is passed to a function or method.
 */
export class ArgumentError extends SystemError {
    /**
     * The name of the invalid argument.
     */
    parameterName: string | null;

    /**
     * Creates a new instance of the ArgumentError class.
     * @param parameterName - The name of the invalid argument.
     * @param message - The error message.
     */
    constructor(parameterName: string | null = null, message?: string) {
        super(message || `Argument ${parameterName} is invalid.`);
        this.parameterName = parameterName;
        this.name = "ArgumentError";
    }

    /**
     * Converts the ArgumentError instance to a plain object.
     * @returns The plain object representation of the ArgumentError instance.
     */
    toObject(): ErrorProps & { parameterName: string | null } {
        return {
            ...super.toObject(),
            parameterName: this.parameterName,
        };
    }
}

/**
 * Represents an assertion error.
 */
export class AssertionError extends SystemError {
    constructor(message?: string) {
        super(message || "Assertion failed.");
        this.name = "AssertionError";
    }
}

/**
 * Represents an error that is thrown when an argument is null or undefined.
 */
export class ArgumentNullError extends ArgumentError {
    /**
     * Creates a new instance of the ArgumentNullError class.
     * @param parameterName - The name of the argument that is null or undefined.
     */
    constructor(parameterName: string | null = null) {
        super(`Argument ${parameterName} must not be null or undefined.`);
        this.parameterName = parameterName;
        this.name = "ArgumentError";
    }

    /**
     * Validates the specified value and throws an ArgumentNullError if it is null or undefined.
     * @param value - The value to validate.
     * @param parameterName - The name of the parameter being validated.
     * @throws ArgumentNullError if the value is null or undefined.
     */
    static validate(value: unknown, parameterName: string) {
        if (value === null || value === undefined) {
            throw new ArgumentNullError(parameterName);
        }
    }
}

/**
 * Represents an error that occurs when an operation times out.
 */
export class TimeoutError extends SystemError {
    /**
     * Creates a new instance of the TimeoutError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Operation timed out.");
        this.name = "TimeoutError";
    }
}

/**
 * Represents an error that occurs when an operation is not supported.
 */
export class NotSupportedError extends SystemError {
    constructor(message?: string) {
        super(message || "Operation is not supported.");
        this.name = "NotSupportedError";
    }
}

/**
 * Represents an error that is thrown when an object has been disposed.
 */
export class ObjectDisposedError extends SystemError {
    /**
     * Creates a new instance of the ObjectDisposedError class.
     * @param message - The error message.
     * @param innerError - The inner error, if any.
     */
    constructor(message?: string, innerError?: Error) {
        super(message || "Object has been disposed.", innerError);
        this.name = "ObjectDisposedError";
    }
}

/**
 * Represents an error that is thrown when an argument is null or empty.
 */
export class ArgumentEmptyError extends ArgumentError {
    /**
     * Creates a new instance of the ArgumentEmptyError class.
     * @param parameterName - The name of the parameter that is null or empty.
     */
    constructor(parameterName: string | null = null) {
        super(`Argument ${parameterName} must not be null or empty.`);
        this.parameterName = parameterName;
        this.name = "ArgumentError";
    }
}

/**
 * Represents an error that is thrown when an argument
 * is null, empty, or whitespace.
 */
export class ArgumentWhiteSpaceError extends ArgumentError {
    /**
     * Creates a new instance of the ArgumentWhiteSpaceError class.
     * @param parameterName - The name of the parameter that caused the error.
     */
    constructor(parameterName: string | null = null) {
        super(
            `Argument ${parameterName} must not be null, empty, or whitespace.`,
        );
        this.parameterName = parameterName;
        this.name = "ArgumentError";
    }
}

/**
 * Represents an error that occurs when an argument is out of range.
 * @extends ArgumentError
 */
export class ArgumentRangeError extends ArgumentError {
    /**
     * Creates a new instance of the ArgumentRangeError class.
     * @param parameterName - The name of the parameter that is out of range.
     * @param message - The error message.
     */
    constructor(parameterName: string | null = null, message?: string) {
        super(message || `Argument ${parameterName} is out of range.`);
        this.parameterName = parameterName;
        this.name = "ArgumentError";
    }
}

/**
 * Represents an error that occurs when a method or
 * functionality is not implemented.
 */
export class NotImplementedError extends SystemError {
    /**
     * Creates a new instance of the NotImplementedError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Not implemented");
        this.name = "NotImplementedError";
    }
}

/**
 * Represents an error that occurs when an invalid operation is performed.
 */
export class InvalidOperationError extends SystemError {
    /**
     * Creates a new instance of the InvalidOperationError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Invalid operation");
        this.name = "InvalidOperationError";
    }
}

/**
 * Represents an error that occurs when an invalid cast is attempted.
 */
export class InvalidCastError extends SystemError {
    /**
     * Creates a new instance of the InvalidCastError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Invalid cast");
        this.name = "InvalidCastError";
    }
}

/**
 * Represents an error that occurs when a null or undefined reference is encountered.
 */
export class NullReferenceError extends SystemError {
    /**
     * Creates a new instance of the NullReferenceError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Null or undefined reference");
        this.name = "NullReferenceError";
    }
}

/**
 * Represents a format error in the system.
 */
export class FormatError extends SystemError {
    /**
     * Creates a new instance of the FormatError class.
     * @param message - The error message.
     */
    constructor(message?: string) {
        super(message || "Format SystemError");
        this.name = "FormatError";
    }
}

/**
 * Collects all the errors from the given error object and its nested errors.
 *
 * @param e - The error object to collect errors from.
 * @returns An array of all the collected errors.
 */
export function collect(e: Error): Error[] {
    const errors: Error[] = [];

    walk(e, (error) => errors.push(error));

    return errors;
}

/**
 * Recursively walks through an error and its inner errors (if any),
 * and invokes a callback function for each error encountered.
 * @param e - The error to walk through.
 * @param callback - The callback function to invoke for each error encountered.
 */
export function walk(e: Error, callback: (e: Error) => void): void {
    if (e instanceof AggregateError && e.errors) {
        for (const error of e.errors) {
            walk(error, callback);
        }
    }

    if (e instanceof SystemError && e.innerError) {
        walk(e.innerError, callback);
    }

    callback(e);
}

/**
 * Prints the error to the console and if an error derives from SystemError,
 * it will print the inner error as well.
 *
 * @param e The error to print to the console.
 * @param format Formats the error to the console.
 * @returns
 */
export function printError(e: Error, format?: (e: Error) => string): void {
    if (e instanceof AggregateError && e.errors) {
        for (const error of e.errors) {
            printError(error, format);
        }
    }

    if (e instanceof SystemError && e.innerError) {
        printError(e.innerError, format);
    }

    if (format) {
        console.error(format(e));
        return;
    }

    console.error(e);
}
