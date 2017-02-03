const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const { BlogPost } = require('../models');
const { app, runServer, closeServer } = require('../server');
const { TEST_DATABASE_URL } = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogPostData() {
    console.info('seeding blog post data');
    const seedData = [];

    for (let i = 1; i <= 10; i++) {
        seedData.push(generateBlogPostData());
    }
    // this will return a promise
    return BlogPost.insertMany(seedData);
}


// generate an object representing a blog post.
function generateBlogPostData() {
    return {
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()
        },
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        created: faker.date.past()
    }
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block 
function tearDownDb() {
    return new Promise((resolve, reject) => {
        console.warn('Deleting database');
        mongoose.connection.dropDatabase()
            .then(result => resolve(result))
            .catch(err => reject(err))
    });
}

describe('Blog App API resource', function() {

    // we need each of these hook functions to return a promise
    // otherwise we'd need to call a `done` callback. `runServer`,
    // `seedBlogPostData` and `tearDownDb` each return a promise,
    // so we return the value returned by these function calls.
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedBlogPostData();
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    })



    describe('GET endpoint', function() {

        it('should return all existing blog posts', function() {
            // strategy:
            //    1. get back all blog posts returned by by GET request to `/posts`
            //    2. prove res has right status, data type
            //    3. prove the number of blog posts we got back is equal to number
            //       in db.
            //
            // need to have access to mutate and access `res` across
            // `.then()` calls below, so declare it here so can modify in place
            let res;
            return chai.request(app)

            .get('/posts')
                .then(function(_res) {
                    // so subsequent .then blocks can access resp obj.
                    res = _res;
                    res.should.have.status(200);
                    // otherwise our db seeding didn't work
                    res.body.should.have.length.of.at.least(1);
                    return BlogPost.count();
                })
                .then(function(count) {
                    res.body.should.have.length.of(count);
                });
        });

        it('should return blog posts with right fields', function() {
            // Strategy: Get back all blog posts, and ensure they have expected keys

            let resPost;
            return chai.request(app)
                .get('/posts')
                .then(function(res) {
                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);

                    res.body.forEach(function(blogPost) {
                        blogPost.should.be.a('object');
                        blogPost.should.include.keys(
                            'id', 'author', 'content', 'title', 'created');
                    });
                    resPost = res.body[0];
                    return BlogPost.findById(resPost.id);
                })
                .then(function(blogPost) {
                    resPost.id.should.equal(blogPost._id.toString());
                    resPost.author.should.equal(
                        blogPost.author.firstName + " " + blogPost.author.lastName);
                    resPost.content.should.equal(blogPost.content);
                    resPost.title.should.equal(blogPost.title);
                    console.log("respost= " + resPost.created + "\nblogpost= " + blogPost.created);
                    Date(resPost.created).should.equal(Date(blogPost.created));
                });
        });
    });

    // describe('POST endpoint', function() {
    //     // strategy: make a POST request with data,
    //     // then prove that the blog post we get back has
    //     // right keys, and that `id` is there (which means
    //     // the data was inserted into db)
    //     it('should add a new blog post', function() {

    //         const newBlogPost = generateBlogPostData();
    //         return chai.request(app)
    //             .post('/posts')
    //             .send(newBlogPost)
    //             .then(function(res) {

    //             console.log("new blogpost= ++++++++++++++++++++++++++++++++++++++++++++++" + newBlogPost.firstName);
    //         	console.log("res blogpost= ++++++++++++++++++++++++++++++++++++++++++++++" + res.body.firstName);



    //                 res.should.have.status(201);
    //                 res.should.be.json;
    //                 res.body.should.be.a('object');
    //                 res.body.should.include.keys(
    //                     'id', 'author', 'content', 'title', 'created');
    //                 // res.body.author.should.equal(
    //                 // 	newBlogPost.author.firstName + " " + newBlogPost.author.lastName);
    //                 // cause Mongo should have created id on insertion
    //                 res.body.id.should.not.be.null;
    //                 res.body.content.should.equal(newBlogPost.content);
    //                 res.body.title.should.equal(newBlogPost.title);
    //                 Date(res.body.created).should.equal(Date(newBlogPost.created));

    //                 return BlogPost.findById(res.body.id);
    //             })
    //             .then(function(blogpost) {
    //                 blogpost.author.should.equal(newBlogPost.author);
    //                 blogpost.cuisine.should.equal(newRestaurant.cuisine);
    //                 blogpost.borough.should.equal(newRestaurant.borough);
    //                 blogpost.name.should.equal(newRestaurant.name);
    //                 blogpost.grade.should.equal(mostRecentGrade);
    //                 blogpost.address.building.should.equal(newRestaurant.address.building);
    //                 blogpost.address.street.should.equal(newRestaurant.address.street);
    //                 blogpost.address.zipcode.should.equal(newRestaurant.address.zipcode);
    //             });
    //     });
    // });


    describe('PUT endpoint', function() {

        // strategy:
        //  1. Get an existing blog post from db
        //  2. Make a PUT request to update that blog post
        //  3. Prove blog post returned by request contains data we sent
        //  4. Prove blog post in db is correctly updated
        it('should update fields you send over', function() {
            const updateData = {
                author: {
                    firstName: "Callie",
                    lastName: "Walsh"
                },
                title: "My new title is right here",
            };

            return BlogPost
                .findOne()
                .exec()
                .then(function(blogPost) {
                    updateData.id = blogPost.id;

                    // make request then inspect it to make sure it reflects
                    // data we sent
                    return chai.request(app)
                        .put(`/posts/${blogPost.id}`)
                        .send(updateData);
                })
                .then(function(res) {
                    // res.should.have.status(204);

                    return BlogPost.findById(updateData.id).exec();
                })
                .then(function(blogPost) {
                    blogPost.author.firstName.should.equal(updateData.author.firstName);
                    blogPost.author.lastName.should.equal(updateData.author.lastName);
                    blogPost.title.should.equal(updateData.title);
                });
        });
    });

    // describe('DELETE endpoint', function() {
    //   // strategy:
    //   //  1. get a restaurant
    //   //  2. make a DELETE request for that restaurant's id
    //   //  3. assert that response has right status code
    //   //  4. prove that restaurant with the id doesn't exist in db anymore
    //   it('delete a restaurant by id', function() {

    //     let restaurant;

    //     return Restaurant
    //       .findOne()
    //       .exec()
    //       .then(function(_restaurant) {
    //         restaurant = _restaurant;
    //         return chai.request(app).delete(`/restaurants/${restaurant.id}`);
    //       })
    //       .then(function(res) {
    //         res.should.have.status(204);
    //         return Restaurant.findById(restaurant.id).exec();
    //       })
    //       .then(function(_restaurant) {
    //         // when a variable's value is null, chaining `should`
    //         // doesn't work. so `_restaurant.should.be.null` would raise
    //         // an error. `should.be.null(_restaurant)` is how we can
    //         // make assertions about a null value.
    //         should.not.exist(_restaurant);
    //       });
    //   });
    // });

    function printObj(res) {
        console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
        console.log(res);
        let objStr = "";
    };
});
