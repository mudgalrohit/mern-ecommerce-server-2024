import mongoose, { Document } from "mongoose";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { InvalidateCacheProps, OrderItemType } from "../types/types.js";
import { myCache } from "../app.js";
import { Product } from "../models/product.js";
import { Order } from "../models/order.js";

export const uploadToCloudinary = async (localFilePath: string) => {//return type of this
  //is Promise<UploadApiResponse> because of async await
  const promise = new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload(localFilePath, (error, result) => {
        if (error) return reject(error);
        resolve(result!);//this will give error without !
        //<UploadApiResponse>|undefined not assignable to <UploadApiResponse>
      });
    });
  const result = await promise;
  return {
    public_id: result.public_id,
    url: result.secure_url,
  };
};

export const deleteFromCloudinary = async (cloudPhotoId: string) => {//return type of this
  //is Promise<void> because of async await
  const promise = new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(cloudPhotoId, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  await promise;
};

export const connectDB = (uri: string) => {
  mongoose
    .connect(uri, {
      dbName: "Ecommerce_24",
    })
    .then((c) => console.log(`DB Connected to ${c.connection.host}`))
    .catch((e) => console.log(e));
};

export const invalidateCache = ({
  product,
  order,
  admin,
  userId,
  orderId,
  productId,
}: InvalidateCacheProps) => {
  if (product) {
    const productKeys: string[] = [
      "latest-products",
      "categories",
      "all-products",
    ];
    if (typeof productId === "string") productKeys.push(`product-${productId}`);
    if (typeof productId === "object")
      productId.forEach((i) => productKeys.push(`product-${i}`));

    myCache.del(productKeys);
  }
  if (order) {
    const ordersKeys: string[] = [
      "all-orders",
      `my-orders-${userId}`,
      `order-${orderId}`,
    ];
    myCache.del(ordersKeys);
  }
  if (admin) {
    myCache.del([
      "admin-stats",
      "admin-pie-charts",
      "admin-bar-charts",
      "admin-line-charts",
    ]);
  }
};

export const reduceStock = async (orderItems: OrderItemType[]) => {
  for (let i = 0; i < orderItems.length; i++) {
    const order = orderItems[i];
    const product = await Product.findById(order.productId);
    if (!product) throw new Error("Product Not Found");
    product.stock -= order.quantity;
    await product.save();
  }
};

export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
  if (lastMonth === 0) return thisMonth * 100;
  const percent = (thisMonth / lastMonth) * 100;
  return Number(percent.toFixed(0));
};

export const getInventories = async ({
  categories,
  productsCount,
}: {
  categories: string[];
  productsCount: number;
}) => {
  const categoriesCountPromise = categories.map((category) =>
    Product.countDocuments({ category })
  );

  const categoriesCount = await Promise.all(categoriesCountPromise);

  const categoryCount: Record<string, number>[] = [];

  categories.forEach((category, i) => {
    categoryCount.push({
      [category]: Math.round((categoriesCount[i] / productsCount) * 100),
    });
  });
  return categoryCount;
};

export interface MyDocument extends Document {
  createdAt: Date;
  discount?: number;
  total?: number;
}

type FuncProps = {
  length: number;
  docArr: MyDocument[];
  today: Date;
  property?: "discount" | "total";
};

export const getChartData = ({
  length,
  docArr,
  today,
  property,
}: FuncProps) => {
  const data: number[] = new Array(length).fill(0);

  docArr.forEach((i) => {
    const creationDate = i.createdAt;
    const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
    if (monthDiff < length) {
      if (property) {
        data[length - monthDiff - 1] += i[property]!;
      } else {
        data[length - monthDiff - 1] += 1;
      }
    }
  });
  return data;
};
