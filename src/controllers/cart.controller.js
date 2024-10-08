import TicketModel from "../models/ticket.model.js";
import UserModel from "../models/user.model.js";
import CartRepository from "../repositories/cart.repository.js";
const cartRepository = new CartRepository();
import ProductRepository from "../repositories/product.repository.js";
const productRepository = new ProductRepository();
import { generateUniqueCode, calcularTotal } from "../utils/cartutils.js";
import EmailManager from "../services/email.js";
const emailManager = new EmailManager();
import TicketRepository from "../repositories/ticket.repository.js";
const ticketRepository = new TicketRepository();




class CartController {
    async nuevoCarrito(req, res) {
        try {
            const nuevoCarrito = await cartRepository.crearCarrito();
            res.json(nuevoCarrito);
        } catch (error) {
            res.status(500).send("Error");
        }
    }

    async obtenerProductosDeCarrito(req, res) {
        const carritoId = req.params.cid;
        try {
            const productos = await cartRepository.obtenerProductosDeCarrito(carritoId);
            if (!productos) {
                return res.status(404).json({ error: "Carrito no encontrado" });
            }
            res.json(productos);
        } catch (error) {
            res.status(500).send("Error");
        }
    }
    
    async agregarProductoEnCarrito(req, res) {
        const cartId = req.params.cid;
        const productId = req.params.pid;
        const quantity = parseInt(req.body.quantity) || 1;
    
        console.log("Cantidad que recibo:", quantity);
        console.log("Cart ID en productinfo:", res.locals.cartId); // Debugging
    
        try {
            await cartRepository.agregarProducto(cartId, productId, quantity);
            const carritoID = cartId;
    
            res.redirect(`/carts/${carritoID}`);
        } catch (error) {
            res.status(500).send("Error al agregar el producto al carrito");
        }
    }
    

    async eliminarProductoDeCarrito(req, res) {
        const cartId = req.params.cid;
        const productId = req.params.pid;
        try {
            const updatedCart = await cartRepository.eliminarProducto(cartId, productId);
            res.json({
                status: 'success',
                message: 'Producto eliminado del carrito correctamente',
                updatedCart,
            });
        } catch (error) {
            res.status(500).send("Error");
        }
    }

    async actualizarProductosEnCarrito(req, res) {
        const cartId = req.params.cid;
        const updatedProducts = req.body;

        try {
            const updatedCart = await cartRepository.actualizarProductosEnCarrito(cartId, updatedProducts);
            res.json(updatedCart);
        } catch (error) {
            res.status(500).send("Error");
        }
    }

    async actualizarCantidad(req, res) {
        const cartId = req.params.cid;
        const productId = req.params.pid;
        const newQuantity = req.body.quantity;
        try {
            const updatedCart = await cartRepository.actualizarCantidadesEnCarrito(cartId, productId, newQuantity);

            res.json({
                status: 'success',
                message: 'Cantidad del producto actualizada correctamente',
                updatedCart,
            });

        } catch (error) {
            res.status(500).send("Error al actualizar la cantidad de productos");
        }
    }

    async vaciarCarrito(req, res) {
        const cartId = req.params.cid;
        try {
            const updatedCart = await cartRepository.vaciarCarrito(cartId);

            res.json({
                status: 'success',
                message: 'Todos los productos del carrito fueron eliminados correctamente',
                updatedCart,
            });

        } catch (error) {
            res.status(500).send("Error");
        }
    }

    async finalizarCompra(req, res) {
        const cartId = req.params.cid;
        try {
            const cart = await cartRepository.obtenerProductosDeCarrito(cartId);
            const products = cart.products;

            const productosNoDisponibles = [];

            for (const item of products) {
                const productId = item.product;
                const product = await productRepository.obtenerProductoPorId(productId);
                if (product.stock >= item.quantity) {
                    product.stock -= item.quantity;
                    await product.save();
                } else {
                    productosNoDisponibles.push(productId);
                }
            }

            const userWithCart = await UserModel.findOne({ cart: cartId });
            
            const ticket = await ticketRepository.crearTicket({
                code: generateUniqueCode(),
                purchase_datetime: new Date(),
                amount: calcularTotal(cart.products),
                purchaser: userWithCart._id,
                products: cart.products
            });

            await cartRepository.vaciarCarrito(cartId);

            await emailManager.enviarCorreoCompra(userWithCart.email, userWithCart.first_name, ticket._id);

            res.render("checkout", {
                cliente: userWithCart.first_name,
                email: userWithCart.email,
                numTicket: ticket._id
            });
        } catch (error) {
            console.error('Error al procesar la compra:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

}

export default CartController;
